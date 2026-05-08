pub mod lexer;
pub mod parser;
pub mod planner;

use datafusion::logical_expr::LogicalPlan;
use datafusion::prelude::SessionContext;

/// Top-level error type, wrapping the three internal stages.
#[derive(Debug)]
pub enum ScryfallError {
    Lex(lexer::LexError),
    Parse(parser::ParseError),
    Plan(planner::PlanError),
}

impl std::fmt::Display for ScryfallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScryfallError::Lex(e) => write!(f, "{e}"),
            ScryfallError::Parse(e) => write!(f, "{e}"),
            ScryfallError::Plan(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for ScryfallError {}

impl From<lexer::LexError> for ScryfallError {
    fn from(e: lexer::LexError) -> Self {
        ScryfallError::Lex(e)
    }
}

impl From<parser::ParseError> for ScryfallError {
    fn from(e: parser::ParseError) -> Self {
        ScryfallError::Parse(e)
    }
}

impl From<planner::PlanError> for ScryfallError {
    fn from(e: planner::PlanError) -> Self {
        ScryfallError::Plan(e)
    }
}

pub async fn parse_query(ctx: &SessionContext, input: &str) -> Result<LogicalPlan, ScryfallError> {
    // Stage 1 – Lex
    let tokens = lexer::tokenize(input)?;

    // Stage 2 – Parse
    let ast = parser::parse(tokens)?;

    // Stage 3 – Plan
    let plan = planner::build_query_plan(ctx, &ast).await?;

    Ok(plan)
}

pub fn parse_to_ast(input: &str) -> Result<parser::ScryfallExpr, ScryfallError> {
    let tokens = lexer::tokenize(input)?;
    let ast = parser::parse(tokens)?;
    Ok(ast)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query_executor::context::get_local_context;
    use arrow_array::{Array, ListArray, RecordBatch, StringArray, StringViewArray};
    use datafusion::prelude::SessionContext;
    use std::sync::Arc;

    async fn execute_query(ctx: &SessionContext, query: &str) -> Vec<RecordBatch> {
        let plan = parse_query(ctx, query)
            .await
            .expect("Failed to parse query");
        let df = ctx
            .execute_logical_plan(plan)
            .await
            .expect("Failed to execute plan");
        df.collect().await.expect("Failed to collect results")
    }

    fn get_column<'a>(batch: &'a RecordBatch, name: &str) -> &'a Arc<dyn Array> {
        batch
            .column_by_name(name)
            .or_else(|| batch.column_by_name(&format!("cards.{}", name)))
            .or_else(|| batch.column_by_name(&format!("prints.{}", name)))
            .unwrap_or_else(|| {
                panic!(
                    "Column {} not found. Available: {:?}",
                    name,
                    batch
                        .schema()
                        .fields()
                        .iter()
                        .map(|f| f.name())
                        .collect::<Vec<_>>()
                )
            })
    }

    fn get_string_value(array: &Arc<dyn Array>, i: usize) -> &str {
        if let Some(a) = array.as_any().downcast_ref::<StringArray>() {
            return a.value(i);
        }
        if let Some(a) = array.as_any().downcast_ref::<StringViewArray>() {
            return a.value(i);
        }
        panic!("Unsupported string array type: {:?}", array.data_type());
    }

    #[tokio::test]
    async fn test_unique_prints() {
        let ctx = get_local_context().await.unwrap();
        // Opt has many prints. unique:prints should return multiple records.
        let results = execute_query(&ctx, "name=\"Opt\" unique:prints").await;
        let total_rows: usize = results.iter().map(|b| b.num_rows()).sum();
        assert!(
            total_rows > 1,
            "Expected many prints for Opt, got {}",
            total_rows
        );

        // All rows should have the name "Opt"
        for batch in results {
            let name_col = get_column(&batch, "name");
            for i in 0..batch.num_rows() {
                assert_eq!(get_string_value(name_col, i), "Opt");
            }
        }
    }

    #[tokio::test]
    async fn test_unique_cards() {
        let ctx = get_local_context().await.unwrap();
        // unique:cards is the default. Should return exactly 1 record for Opt.
        let results = execute_query(&ctx, "name=\"Opt\" unique:cards").await;
        let total_rows: usize = results.iter().map(|b| b.num_rows()).sum();
        assert_eq!(total_rows, 1, "Expected 1 card for Opt, got {}", total_rows);
    }

    #[tokio::test]
    async fn test_order_and_dir() {
        let ctx = get_local_context().await.unwrap();
        // Query for several cards and order them by CMC descending.
        // Opt (1), Crusade (2), Pradesh Gypsies (3)
        let query =
            "(name=\"Opt\" or name=\"Crusade\" or name=\"Pradesh Gypsies\") order:cmc dir:desc";
        let results = execute_query(&ctx, query).await;

        let mut names = Vec::new();
        for batch in results {
            let name_col = get_column(&batch, "name");
            for i in 0..batch.num_rows() {
                names.push(get_string_value(name_col, i).to_string());
            }
        }

        // Expected order: Pradesh Gypsies (3) -> Crusade (2) -> Opt (1)
        assert_eq!(
            names,
            vec!["Pradesh Gypsies", "Crusade", "Opt"],
            "Ordering failed. Got: {:?}",
            names
        );

        // Now test ascending
        let query_asc =
            "(name=\"Opt\" or name=\"Crusade\" or name=\"Pradesh Gypsies\") order:cmc dir:asc";
        let results_asc = execute_query(&ctx, query_asc).await;

        let mut names_asc = Vec::new();
        for batch in results_asc {
            let name_col = get_column(&batch, "name");
            for i in 0..batch.num_rows() {
                names_asc.push(get_string_value(name_col, i).to_string());
            }
        }

        assert_eq!(
            names_asc,
            vec!["Opt", "Crusade", "Pradesh Gypsies"],
            "Ordering failed (asc). Got: {:?}",
            names_asc
        );
    }

    #[tokio::test]
    async fn test_prefer_oldest_newest() {
        let ctx = get_local_context().await.unwrap();

        // Get the oldest print scryfall_id for Opt
        let results_oldest = execute_query(&ctx, "name=\"Opt\" prefer:oldest").await;
        let id_oldest = get_first_scryfall_id(&results_oldest);

        // Get the newest print scryfall_id for Opt
        let results_newest = execute_query(&ctx, "name=\"Opt\" prefer:newest").await;
        let id_newest = get_first_scryfall_id(&results_newest);

        assert_ne!(
            id_oldest, id_newest,
            "Oldest and newest prints should be different for Opt"
        );
    }

    fn get_first_scryfall_id(batches: &[RecordBatch]) -> String {
        assert!(!batches.is_empty());
        let batch = &batches[0];
        assert!(batch.num_rows() > 0);

        let matched_prints = batch
            .column_by_name("matched_prints")
            .expect("missing matched_prints")
            .as_any()
            .downcast_ref::<ListArray>()
            .expect("matched_prints is not a ListArray");

        let inner_array = matched_prints.value(0);
        get_string_value(&inner_array, 0).to_string()
    }
}
