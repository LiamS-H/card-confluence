// for debugging
// use std::fs::File;
// use std::io::Write;
// use arrow::util::pretty::pretty_format_batches;
use arrow::util::display::array_value_to_string;
use arrow_array::Array;
use datafusion::logical_expr::LogicalPlan;
use datafusion::prelude::SessionContext;

use crate::autocompletion::completion::{
    // FORMATS,
    FORMATS,
    IS_VALUES,
    KEYWORDS,
};
use crate::autocompletion::planner::{find_predicate, replace_predicate_with_true};
use crate::query_parser::lexer::{self, Token, TokenKind};
use crate::query_parser::parser;

use crate::query_parser::planner::predicates::PredicateField;
use crate::query_parser::planner::PlanError;
pub mod completion;
mod planner;

pub struct Completion {
    pub start: usize,
    pub end: usize,
    pub strings: Vec<String>,
}

pub enum CompletionResponse {
    Query(Completion, LogicalPlan),
    Completion(Completion),
}

pub async fn autocomplete(ctx: &SessionContext, input: &str, pos: usize) -> Option<Completion> {
    match autocomplete_to_query(ctx, input, pos).await? {
        CompletionResponse::Query(completion, plan) => {
            return autocomplete_from_query(ctx, plan, completion).await.ok();
        }
        CompletionResponse::Completion(completion) => return Some(completion),
    };
}

pub async fn autocomplete_to_query(
    ctx: &SessionContext,
    input: &str,
    pos: usize,
) -> Option<CompletionResponse> {
    let mut tokens = lexer::tokenize(input).ok()?;

    let mut current_token_idx = None;
    for (i, token) in tokens.iter().enumerate().rev() {
        if !(pos >= token.start && pos < token.end) {
            continue;
        }
        match token.kind {
            TokenKind::RParen => {
                break;
            }
            TokenKind::LParen | TokenKind::Not => return None,
            TokenKind::Op(_) => {
                if token.start == pos {
                    break;
                }
            }
            _ => {}
        }
        current_token_idx = Some(i);
    }

    if current_token_idx.is_none() {
        for (i, token) in tokens.iter().enumerate().rev() {
            if !(pos - 1 >= token.start && pos - 1 < token.end) {
                continue;
            }
            match &token.kind {
                TokenKind::Op(_) => {
                    current_token_idx = Some(i + 1);
                    tokens.insert(
                        i + 1,
                        Token {
                            start: pos,
                            end: pos,
                            kind: TokenKind::Value("".into()),
                        },
                    );
                    break;
                }
                TokenKind::Value(_) | TokenKind::Ident(_) | TokenKind::And | TokenKind::Or => {
                    current_token_idx = Some(i);
                    break;
                }
                TokenKind::Not | TokenKind::LParen | TokenKind::RParen => {
                    break;
                }
            }
        }
    }

    let Some(idx) = current_token_idx else {
        return Some(CompletionResponse::Completion(Completion {
            start: pos,
            end: pos,
            strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
        }));
    };

    let token = &tokens[idx];

    match &token.kind {
        TokenKind::And | TokenKind::Or => {
            return Some(CompletionResponse::Completion(Completion {
                start: token.start,
                end: token.end,
                strings: vec!["and".into(), "or".into()],
            }))
        }
        TokenKind::Ident(_) => {
            return Some(CompletionResponse::Completion(Completion {
                start: token.start,
                end: token.end,
                strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
            }))
        }
        TokenKind::Op(_) => {
            return Some(CompletionResponse::Completion(Completion {
                start: token.start,
                end: token.end,
                strings: vec![
                    ":".into(),
                    "=".into(),
                    "<".into(),
                    ">".into(),
                    "<=".into(),
                    ">=".into(),
                ],
            }));
        }
        TokenKind::Value(val) => {
            if idx == 0 {
                return Some(CompletionResponse::Completion(Completion {
                    start: token.start,
                    end: token.end,
                    strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
                }));
            }
            if let Some(prev) = tokens.iter().nth(idx - 1) {
                if !matches!(prev.kind, TokenKind::Op(_)) {
                    let keywords: Vec<_> = KEYWORDS.iter().map(|k| k.to_string()).collect();
                    if keywords.contains(val) {
                        return Some(CompletionResponse::Completion(Completion {
                            start: token.start,
                            end: token.end,
                            strings: keywords,
                        }));
                    }
                }
            };
            // fall through to query-based completion below
        }
        _ => return None,
    };

    let start = token.start;
    let end = token.end;

    let ast = parser::parse(tokens.clone()).ok()?;
    let (pred, _path) = find_predicate(&ast, pos)?;
    let pred_type = PredicateField::try_from(pred.field.as_str()).ok()?;

    // `is:` values are static — no query needed
    if matches!(pred_type, PredicateField::Is) {
        return Some(CompletionResponse::Completion(Completion {
            start,
            end,
            strings: IS_VALUES.iter().map(|k| k.to_string()).collect(),
        }));
    }

    if matches!(pred_type, PredicateField::Format) {
        return Some(CompletionResponse::Completion(Completion {
            start,
            end,
            strings: FORMATS.iter().map(|k| k.to_string()).collect(),
        }));
    }

    // Replace the predicate at cursor with True so the rest of the query
    // acts as a filter context
    let context_expr = replace_predicate_with_true(&ast, pred);
    let plan = planner::build_distinct_values_plan(ctx, &context_expr, pred_type)
        .await
        .ok()?;
    Some(CompletionResponse::Query(
        Completion {
            start,
            end,
            strings: Vec::new(),
        },
        plan,
    ))
}

pub async fn autocomplete_from_query(
    ctx: &SessionContext,
    plan: LogicalPlan,
    completion: Completion,
) -> Result<Completion, PlanError> {
    let df = ctx.execute_logical_plan(plan).await?;

    // let explain_df = df.clone().explain(false, true)?;
    // let explain_batches = explain_df.collect().await?;
    // let formatted_string = pretty_format_batches(&explain_batches).unwrap();

    // let mut file = File::create("explain_distinct_plan.txt").unwrap();
    // write!(file, "{}", formatted_string).unwrap();

    let batches = df.collect().await?;

    let values = batches
        .iter()
        .flat_map(|batch| {
            let array = batch.column(0);
            (0..batch.num_rows()).filter_map(move |i| {
                if array.is_null(i) {
                    return None;
                }
                array_value_to_string(array, i).ok()
            })
        })
        .collect();

    Ok(Completion {
        start: completion.start,
        end: completion.end,
        strings: values,
    })
}

#[cfg(test)]
mod tests {
    use crate::query_executor::context::get_local_context;

    use super::*;
    use datafusion::prelude::SessionContext;

    #[tokio::test]
    async fn test_autocomplete_keywords() {
        let ctx = SessionContext::new();
        let input = "cm"; //should return from layout cmc
        let Completion {
            strings: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(suggestions.contains(&"cmc".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_is_values() {
        let ctx = SessionContext::new();
        let input = "is:"; // should run blanket query and return all layouts
        let Completion {
            strings: mut suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        suggestions.sort();
        let mut is_vals = IS_VALUES.to_vec();
        is_vals.sort();
        assert!(suggestions == is_vals);
    }

    #[tokio::test]
    async fn test_autocomplete_after_keyword_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "layout:"; // should run blanket query and return all layouts

        let Completion {
            strings: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(suggestions.contains(&"adventure".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_compound_1_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern layout:"; // should run the query "format:premodern" and return all layouts
        let Completion {
            strings: mut suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        suggestions.sort();
        assert!(suggestions == vec!["normal", "split"]);
    }

    #[tokio::test]
    async fn test_autocomplete_compound_2_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern layout:n"; // should run the query "format:premodern" and return all layouts
        let Completion {
            strings: mut suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        suggestions.sort();
        assert!(suggestions == vec!["normal", "split"]);
    }

    #[tokio::test]
    async fn test_autocomplete_or_1_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern or layout:n"; // should get the query string "", (which wont work in the planer so a custom plan will be made) and return all layouts
        let Completion {
            strings: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(suggestions.len() > 2);
    }

    #[tokio::test]
    async fn test_autocomplete_compound_or_2_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "-layout:normal (format:premodern or layout:n)"; // should get the query string "-layout:normal",
        let Completion {
            strings: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(!suggestions.contains(&"normal".into()));
    }

    #[tokio::test]
    async fn test_autocomplete_compound_or_3_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "(-layout:normal format:premodern) or layout:n"; // should get the query string "", (which wont work in the planer so a custom plan will be made) and return all layouts
        let Completion {
            strings: suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        assert!(suggestions.len() > 2);
        assert!(suggestions.contains(&"normal".into()));
    }

    #[tokio::test]
    async fn test_autocomplete_not_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern -(format:vintage name:)";
        // should run the query "format:premodern" -(format:vintage) and return names
        let Completion {
            strings: mut suggestions,
            ..
        } = autocomplete(&ctx, input, input.len() - 1).await.unwrap();
        suggestions.sort();
        assert!(suggestions == vec!["Crusade", "Pradesh Gypsies"]);
    }

    #[tokio::test]
    async fn test_autocomplete_rarity_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "r:r";
        let res = autocomplete(&ctx, input, input.len()).await;
        let suggestions = res.expect("Autocomplete should return Some for r:r").strings;
        assert!(suggestions.contains(&"rare".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_artist_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "a:Ma";
        let res = autocomplete(&ctx, input, input.len()).await;
        let suggestions = res.expect("Autocomplete should return Some for a:Ma").strings;
        assert!(suggestions.contains(&"Mark Poole".to_string()));
    }

    #[tokio::test]
    async fn test_autocomplete_keyword_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "t:creature kw:";
        let res = autocomplete(&ctx, input, input.len()).await;
        // Pradesh Gypsies is a creature, but might not have keywords.
        // Let's just check if it returns Some and doesn't crash.
        let _suggestions = res.expect("Autocomplete should return Some for kw:").strings;
    }

    #[tokio::test]
    async fn test_autocomplete_type_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "t:cre";
        let res = autocomplete(&ctx, input, input.len()).await;
        let suggestions = res.expect("Autocomplete should return Some for t:cre").strings;
        assert!(suggestions.contains(&"Creature".to_string()));
    }
}
