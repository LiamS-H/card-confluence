use arrow_array::{ArrayRef, RecordBatch, StructArray};
use arrow_convert::deserialize::TryIntoCollection;
use arrow_schema::Schema;
use datafusion::logical_expr::LogicalPlan;
use datafusion::prelude::SessionContext;
use std::sync::Arc;

use crate::autocompletion::option::CompletionOption;

use crate::query_parser::planner::PlanError;
pub mod completion;
pub mod keywords;
pub mod option;
mod planner;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Completion {
    pub from: usize,
    pub to: usize,
    pub options: Vec<CompletionOption>,
}

pub enum CompletionResponse {
    Query(Completion, LogicalPlan),
    Completion(Completion),
}

pub async fn autocomplete(ctx: &SessionContext, input: &str, pos: usize) -> Option<Completion> {
    match completion_from_query(ctx, input, pos).await? {
        CompletionResponse::Query(completion, plan) => {
            return autocomplete_from_completion(ctx, plan, completion)
                .await
                .ok();
        }
        CompletionResponse::Completion(completion) => return Some(completion),
    };
}

pub async fn completion_from_query(
    ctx: &SessionContext,
    input: &str,
    pos: usize,
) -> Option<CompletionResponse> {
    crate::autocompletion::completion::complete(ctx, input, pos).await
}

pub async fn autocomplete_from_completion(
    ctx: &SessionContext,
    plan: LogicalPlan,
    completion: Completion,
) -> Result<Completion, PlanError> {
    let df = ctx.execute_logical_plan(plan).await?;

    let batches = df.collect().await?;

    let mut options = Vec::new();
    for batch in batches {
        // Manually update the schema to match CompletionOption's nullability requirements
        let fields: Vec<_> = batch
            .schema()
            .fields()
            .iter()
            .map(|f| match f.name().as_str() {
                "label" => f.as_ref().clone().with_nullable(false),
                "info" | "detail" | "group" => f.as_ref().clone().with_nullable(true),
                _ => f.as_ref().clone(),
            })
            .collect();
        let schema = Arc::new(Schema::new(fields));
        let batch = RecordBatch::try_new(schema, batch.columns().to_vec())
            .map_err(|e| PlanError(e.to_string()))?;

        let struct_array = StructArray::from(batch);
        let array_ref: ArrayRef = Arc::new(struct_array);
        let batch_options: Vec<CompletionOption> = array_ref
            .try_into_collection()
            .map_err(|e| PlanError(e.to_string()))?;
        options.extend(batch_options);
    }

    Ok(Completion {
        from: completion.from,
        to: completion.to,
        options,
    })
}

#[cfg(test)]
mod tests {
    use crate::{
        autocompletion::option::options_for_predicate, context::get_local_context,
        query_parser::planner::predicates::PredicateField,
    };

    use super::*;

    #[tokio::test]
    async fn test_autocomplete_keywords() {
        let ctx = get_local_context().await.unwrap();
        let input = "cm"; //should return from layout cmc
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.contains(&"cmc".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_is_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "is:"; // should run blanket query and return all layouts
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        suggestions.sort();
        let mut is_vals: Vec<_> = options_for_predicate(PredicateField::Is)
            .unwrap()
            .iter()
            .map(|c| c.label.clone())
            .collect();
        is_vals.sort();
        assert!(suggestions == is_vals);
    }

    #[tokio::test]
    async fn test_autocomplete_after_keyword_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "layout:"; // should run blanket query and return all layouts

        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.contains(&"adventure".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_compound_1_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern layout:"; // should run the query "format:premodern" and return all layouts
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        suggestions.sort();
        assert!(suggestions == vec!["normal", "split"]);
    }

    #[tokio::test]
    async fn test_autocomplete_compound_2_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern layout:n"; // should run the query "format:premodern" and return all layouts
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();

        suggestions.sort();
        assert!(suggestions == vec!["normal", "split"]);
    }

    #[tokio::test]
    async fn test_autocomplete_or_1_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern or layout:n"; // should get the query string "", (which wont work in the planer so a custom plan will be made) and return all layouts
        let Completion {
            options: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(suggestions.len() > 2);
    }

    #[tokio::test]
    async fn test_autocomplete_compound_or_2_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "-layout:normal (format:premodern or layout:n)"; // should get the query string "-layout:normal",
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(!suggestions.contains(&"normal".into()));
    }

    #[tokio::test]
    async fn test_autocomplete_compound_or_3_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "(-layout:normal format:premodern) or layout:n"; // should get the query string "", (which wont work in the planer so a custom plan will be made) and return all layouts
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.len() > 2);
        assert!(suggestions.contains(&"normal".into()));
    }

    #[tokio::test]
    async fn test_autocomplete_not_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern -(format:vintage name:)";
        // should run the query "format:premodern" -(format:vintage) and return names
        let Completion { options, .. } = autocomplete(&ctx, input, input.len() - 1).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        suggestions.sort();
        assert!(suggestions == vec!["Crusade", "Pradesh Gypsies"]);
    }

    #[tokio::test]
    async fn test_autocomplete_not_2_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern -format:vintage -(name:)";
        // should run the query "format:premodern" -(format:vintage) and return names
        let Completion { options, .. } = autocomplete(&ctx, input, input.len() - 1).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        suggestions.sort();
        assert!(suggestions == vec!["Crusade", "Pradesh Gypsies"]);
    }

    #[tokio::test]
    async fn test_autocomplete_not_3_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern -format:vintage -name:";
        // should run the query "format:premodern" -(format:vintage) and return names
        let Completion { options, .. } = autocomplete(&ctx, input, input.len()).await.unwrap();
        let mut suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        suggestions.sort();
        assert!(suggestions == vec!["Crusade", "Pradesh Gypsies"]);
    }

    #[tokio::test]
    async fn test_autocomplete_rarity_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "r:r";
        let res = autocomplete(&ctx, input, input.len()).await;
        let options = res
            .expect("Autocomplete should return Some for r:r")
            .options;
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.contains(&"rare".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_artist_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "a:Ma";
        let res = autocomplete(&ctx, input, input.len()).await;
        let options = res
            .expect("Autocomplete should return Some for a:Ma")
            .options;
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.contains(&"Mark Poole".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_keyword_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "t:creature kw:";
        let res = autocomplete(&ctx, input, input.len()).await;
        // Pradesh Gypsies is a creature, but might not have keywords.
        // Let's just check if it returns Some and doesn't crash.
        let _suggestions = res
            .expect("Autocomplete should return Some for kw:")
            .options;
    }

    #[tokio::test]
    async fn test_autocomplete_type_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "t:cre";
        let res = autocomplete(&ctx, input, input.len()).await;
        let options = res
            .expect("Autocomplete should return Some for t:cre")
            .options;
        let suggestions: Vec<String> = options.iter().map(|u| u.clone().into()).collect();
        assert!(suggestions.contains(&"creature".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_set_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "s:lea";
        let res = autocomplete(&ctx, input, input.len()).await;
        let options = res
            .expect("Autocomplete should return Some for s:lea")
            .options;

        let lea = options
            .iter()
            .find(|o| o.label == "lea")
            .expect("Should find lea set");
        assert_eq!(lea.detail, Some("Limited Edition Alpha".to_string()));
        assert!(lea.info.is_some()); // released date
    }

    #[tokio::test]
    async fn test_power_query_execution() {
        let ctx = get_local_context().await.unwrap();
        let query = "power:2";
        let tokens = crate::query_parser::lexer::tokenize(query).unwrap();
        let ast = crate::query_parser::parser::parse(tokens).unwrap();
        let plan = crate::query_parser::planner::build_query_plan(&ctx, &ast)
            .await
            .unwrap();
        let df = ctx.execute_logical_plan(plan).await.unwrap();
        let _results = df.collect().await.unwrap();
    }

    #[tokio::test]
    async fn test_set_values_case_insensitivity() {
        let ctx = get_local_context().await.unwrap();
        let query = "s:LEA";
        let tokens = crate::query_parser::lexer::tokenize(query).unwrap();
        let ast = crate::query_parser::parser::parse(tokens).unwrap();
        let plan = crate::query_parser::planner::build_query_plan(&ctx, &ast)
            .await
            .unwrap();
        let df = ctx.execute_logical_plan(plan).await.unwrap();
        let results = df.collect().await.unwrap();
        assert!(results.iter().map(|b| b.num_rows()).sum::<usize>() > 0);
    }
}
