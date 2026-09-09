use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::predicates::PredicateField;

pub mod detail_plan;
pub mod expressions;
pub mod expr;
pub mod filter_plan;
pub mod predicates;
pub mod query_plan;
pub mod simple_plans;

pub use detail_plan::build_cards_detail_plan;
pub use expr::{expr_to_df_expr, needs_prints_table, needs_sets_table};
pub use filter_plan::build_filter_plan;
pub use query_plan::build_query_plan;
pub use simple_plans::{build_rulings_plan, build_sets_plan};

#[derive(Debug)]
pub struct PlanError(pub String);

impl std::fmt::Display for PlanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Plan error: {}", self.0)
    }
}

impl std::error::Error for PlanError {}

impl From<datafusion::error::DataFusionError> for PlanError {
    fn from(e: datafusion::error::DataFusionError) -> Self {
        PlanError(e.to_string())
    }
}

#[derive(Debug, Default)]
pub struct QueryOptions {
    pub order: Option<String>,
    pub dir: Option<String>,
    pub unique: Option<String>,
    pub prefer: Option<String>,
}

pub fn extract_options(expr: &ScryfallExpr) -> Result<(ScryfallExpr, QueryOptions), PlanError> {
    let mut options = QueryOptions::default();
    let filtered_expr = extract_options_recursive(expr, &mut options, false)?;
    Ok((filtered_expr, options))
}

fn extract_options_recursive(
    expr: &ScryfallExpr,
    options: &mut QueryOptions,
    is_nested: bool,
) -> Result<ScryfallExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            let field = PredicateField::try_from(p.field.as_str())?;
            match field {
                PredicateField::Order
                | PredicateField::Dir
                | PredicateField::Unique
                | PredicateField::Prefer => {
                    if is_nested {
                        return Err(PlanError(format!(
                            "Keyword '{}' is not allowed in nested expressions",
                            p.field
                        )));
                    }
                    match field {
                        PredicateField::Order => options.order = Some(p.value.clone()),
                        PredicateField::Dir => options.dir = Some(p.value.clone()),
                        PredicateField::Unique => options.unique = Some(p.value.clone()),
                        PredicateField::Prefer => options.prefer = Some(p.value.clone()),
                        _ => unreachable!(),
                    }
                    Ok(ScryfallExpr::True)
                }
                _ => Ok(expr.clone()),
            }
        }
        ScryfallExpr::And(l, r) => {
            let l_filtered = extract_options_recursive(l, options, is_nested)?;
            let r_filtered = extract_options_recursive(r, options, is_nested)?;
            match (l_filtered, r_filtered) {
                (ScryfallExpr::True, r) => Ok(r),
                (l, ScryfallExpr::True) => Ok(l),
                (l, r) => Ok(ScryfallExpr::And(Box::new(l), Box::new(r))),
            }
        }
        ScryfallExpr::Or(l, r) => {
            let l_filtered = extract_options_recursive(l, options, true)?;
            let r_filtered = extract_options_recursive(r, options, true)?;
            Ok(ScryfallExpr::Or(Box::new(l_filtered), Box::new(r_filtered)))
        }
        ScryfallExpr::Not(inner) => {
            let inner_filtered = extract_options_recursive(inner, options, true)?;
            Ok(ScryfallExpr::Not(Box::new(inner_filtered)))
        }
        ScryfallExpr::True => Ok(ScryfallExpr::True),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query_parser::lexer::tokenize;
    use crate::query_parser::parser::parse;

    fn p(input: &str) -> ScryfallExpr {
        let tokens = tokenize(input).expect("lex");
        parse(tokens).expect("parse")
    }

    #[test]
    fn test_extract_options_simple() {
        let expr = p("t:creature order:cmc");
        let (filtered, options) = extract_options(&expr).unwrap();
        assert_eq!(options.order, Some("cmc".to_string()));
        assert!(matches!(filtered, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_extract_options_multiple() {
        let expr = p("t:creature order:usd dir:desc unique:prints prefer:newest");
        let (filtered, options) = extract_options(&expr).unwrap();
        assert_eq!(options.order, Some("usd".to_string()));
        assert_eq!(options.dir, Some("desc".to_string()));
        assert_eq!(options.unique, Some("prints".to_string()));
        assert_eq!(options.prefer, Some("newest".to_string()));
        assert!(matches!(filtered, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_extract_options_nested_error() {
        let expr = p("t:creature (order:cmc or t:instant)");
        let res = extract_options(&expr);
        assert!(res.is_err());
        assert!(res.unwrap_err().0.contains("not allowed in nested"));

        let expr = p("t:creature (prefer:oldest or t:instant)");
        let res = extract_options(&expr);
        assert!(res.is_err());
        assert!(res.unwrap_err().0.contains("not allowed in nested"));
    }

    #[tokio::test]
    async fn test_build_query_plan_order_usd_unique_cards() {
        let ctx = datafusion::prelude::SessionContext::new();

        // Register mock tables
        use datafusion::arrow::datatypes::{DataType, Field, Schema};
        use datafusion::datasource::MemTable;
        use std::sync::Arc;

        let cards_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("mana_cost", DataType::Utf8, true),
            Field::new("cmc", DataType::Float64, true),
        ]));
        ctx.register_table(
            "cards",
            Arc::new(MemTable::try_new(cards_schema.clone(), vec![vec![]]).unwrap()),
        )
        .unwrap();

        let prices_fields = vec![Field::new("usd", DataType::Float32, true)];
        let prints_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("scryfall_id", DataType::Utf8, false),
            Field::new("set_code", DataType::Utf8, false),
            Field::new("released_at", DataType::Utf8, false),
            Field::new("prices", DataType::Struct(prices_fields.into()), false),
        ]));
        ctx.register_table(
            "prints",
            Arc::new(MemTable::try_new(prints_schema, vec![vec![]]).unwrap()),
        )
        .unwrap();

        let expr = p("t:creature order:usd unique:cards");
        let plan = build_query_plan(&ctx, &expr).await.unwrap();

        let plan_str = format!("{:?}", plan);
        // Verify aggregation includes sort_usd
        assert!(
            plan_str.contains("name: \"sort_usd\""),
            "Aggregation should include sort_usd"
        );
        assert!(
            plan_str.contains("name: \"sort_usd\"") && plan_str.contains("asc: true"),
            "Should sort by sort_usd ASC"
        );
    }

    #[tokio::test]
    async fn test_build_query_plan_order_usd_unique_prints() {
        let ctx = datafusion::prelude::SessionContext::new();

        // Register mock tables
        use datafusion::arrow::datatypes::{DataType, Field, Schema};
        use datafusion::datasource::MemTable;
        use std::sync::Arc;

        let cards_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("mana_cost", DataType::Utf8, true),
            Field::new("cmc", DataType::Float64, true),
        ]));
        ctx.register_table(
            "cards",
            Arc::new(MemTable::try_new(cards_schema.clone(), vec![vec![]]).unwrap()),
        )
        .unwrap();

        let prices_fields = vec![Field::new("usd", DataType::Float32, true)];
        let prints_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("scryfall_id", DataType::Utf8, false),
            Field::new("set_code", DataType::Utf8, false),
            Field::new("released_at", DataType::Utf8, false),
            Field::new("prices", DataType::Struct(prices_fields.into()), false),
        ]));
        ctx.register_table(
            "prints",
            Arc::new(MemTable::try_new(prints_schema, vec![vec![]]).unwrap()),
        )
        .unwrap();

        let expr = p("t:creature order:usd unique:prints");
        let plan = build_query_plan(&ctx, &expr).await.unwrap();

        let plan_str = format!("{:?}", plan);
        println!("{}", plan_str);

        // Verify secondary sorts are present
        assert!(
            plan_str.contains("asc: true, nulls_first: false"),
            "Should have primary USD sort with nulls last"
        );
        assert!(plan_str.contains("Column { relation: Some(Bare { table: \"cards\" }), name: \"name\" }), asc: true, nulls_first: true"), "Should have secondary name sort");
    }

    #[tokio::test]
    async fn test_build_filter_plan() {
        let ctx = datafusion::prelude::SessionContext::new();

        use datafusion::arrow::array::{BooleanArray, Float64Array, StringArray};
        use datafusion::arrow::datatypes::{DataType, Field, Schema};
        use datafusion::arrow::record_batch::RecordBatch;
        use datafusion::datasource::MemTable;
        use std::sync::Arc;

        let cards_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("cmc", DataType::Float64, true),
            Field::new("mana_cost", DataType::Utf8, true),
        ]));

        let cards_data = RecordBatch::try_new(
            cards_schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["id1", "id2", "id3"])),
                Arc::new(StringArray::from(vec!["Card 1", "Card 2", "Card 3"])),
                Arc::new(Float64Array::from(vec![1.0, 2.0, 3.0])),
                Arc::new(StringArray::from(vec![
                    Some("{U}"),
                    Some("{1}{U}"),
                    Some("{2}{U}"),
                ])),
            ],
        )
        .unwrap();

        ctx.register_table(
            "cards",
            Arc::new(MemTable::try_new(cards_schema, vec![vec![cards_data]]).unwrap()),
        )
        .unwrap();

        let prints_schema = Arc::new(Schema::new(vec![
            Field::new("oracle_id", DataType::Utf8, false),
            Field::new("scryfall_id", DataType::Utf8, false),
        ]));
        let prints_data = RecordBatch::try_new(
            prints_schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["id1", "id2", "id3"])),
                Arc::new(StringArray::from(vec!["sid1", "sid2", "sid3"])),
            ],
        )
        .unwrap();

        ctx.register_table(
            "prints",
            Arc::new(MemTable::try_new(prints_schema, vec![vec![prints_data]]).unwrap()),
        )
        .unwrap();

        let ids = vec!["id3".to_string(), "id1".to_string(), "id4".to_string()];
        let expr = p("cmc < 2.5"); // matches id1 and id2
        // id3: cmc=3 (false)
        // id1: cmc=1 (true)
        // id4: not in table (false)

        let plan = build_filter_plan(&ctx, ids, &expr).await.unwrap();
        let df = ctx.execute_logical_plan(plan).await.unwrap();
        let results = df.collect().await.unwrap();

        let total_rows: usize = results.iter().map(|b| b.num_rows()).sum();
        assert_eq!(total_rows, 3);

        let mut matched_values = Vec::new();
        for batch in results {
            let matched_col = batch
                .column(0)
                .as_any()
                .downcast_ref::<BooleanArray>()
                .expect("matched should be a BooleanArray");
            for i in 0..batch.num_rows() {
                matched_values.push(matched_col.value(i));
            }
        }

        assert_eq!(matched_values.len(), 3);
        assert_eq!(matched_values[0], false); // id3
        assert_eq!(matched_values[1], true); // id1
        assert_eq!(matched_values[2], false); // id4
    }
}
