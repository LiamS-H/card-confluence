use datafusion::prelude::SessionContext;

use crate::autocompletion::completion::{
    // FORMATS,
    IS_VALUES,
    KEYWORDS,
};
use crate::query_parser::lexer::{self, Token, TokenKind};
use crate::query_parser::{parser, planner};

pub mod completion;

pub struct Completion {
    pub start: usize,
    pub end: usize,
    pub strings: Vec<String>,
}

pub async fn autocomplete(ctx: &SessionContext, input: &str, pos: usize) -> Option<Completion> {
    // println!(
    //     "\n\"{}\"[{}]=\"{}\"",
    //     input,
    //     pos,
    //     input.chars().nth(pos).unwrap_or_default()
    // );
    let mut tokens = lexer::tokenize(input).ok()?;
    // println!("{:?}", tokens);

    let mut current_token_idx = None;
    // could be bin search; but this is probably faster for short distances
    for (i, token) in tokens.iter().enumerate().rev() {
        if !(pos >= token.start && pos < token.end) {
            continue;
        }
        match token.kind {
            TokenKind::RParen => break, // we can start a new ident recommendation _)
            TokenKind::LParen | TokenKind::Not => return None, // unsure how to handle this one _(),_-
            TokenKind::Op(_) => {
                if token.start == pos {
                    break; // we are at the start of an op look for the token before this
                }
            }
            _ => {}
        }
        current_token_idx = Some(i);
    }

    // if pos isn't in the token tree check for the token before pos
    if current_token_idx.is_none() {
        for (i, token) in tokens.iter().enumerate().rev() {
            if !(pos >= token.start && pos - 1 < token.end) {
                continue;
            }
            match &token.kind {
                TokenKind::Op(_) => {
                    current_token_idx = Some(i + 1); // we are directly after an op add a value to complete the predicate
                    tokens.insert(
                        i,
                        Token {
                            start: pos,
                            end: pos,
                            kind: TokenKind::Value("".into()),
                        },
                    );
                    break;
                }
                TokenKind::Value(_) | TokenKind::Ident(_) | TokenKind::And | TokenKind::Or => {
                    // we are directly after a token that we can complete
                    current_token_idx = Some(i);
                    break;
                }
                TokenKind::Not | TokenKind::LParen | TokenKind::RParen => {
                    break; // break and return the default blank completion (we are at a blank and ready to start an ident)
                }
            }
        }
    }

    let Some(idx) = current_token_idx else {
        // we are on a blank space return the ident suggestion
        return Some(Completion {
            start: pos,
            end: pos,
            strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
        });
    };

    let token = &tokens[idx];

    match &token.kind {
        TokenKind::And | TokenKind::Or => {
            return Some(Completion {
                start: token.start,
                end: token.end,
                strings: vec!["and".into(), "or".into()],
            })
        }
        TokenKind::Ident(_) => {
            return Some(Completion {
                start: token.start,
                end: token.end,
                strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
            })
        }
        TokenKind::Op(_) => {
            // return None;
            return Some(Completion {
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
            });
        }
        TokenKind::Value(val) => {
            if idx == 0 {
                return Some(Completion {
                    start: token.start,
                    end: token.end,
                    strings: KEYWORDS.iter().map(|k| k.to_string()).collect(),
                });
            }
            if let Some(prev) = tokens.iter().nth(idx - 1) {
                if !matches!(prev.kind, TokenKind::Op(_)) {
                    let keywords: Vec<_> = KEYWORDS.iter().map(|k| k.to_string()).collect();
                    if keywords.contains(val) {
                        return Some(Completion {
                            start: token.start,
                            end: token.end,
                            strings: keywords,
                        });
                    }
                }
            };

            // we move on to the complicated query completion
        }
        _ => return None,
    };

    // the tree should now be able to be parsed
    let start = token.start;
    let end = token.end;

    let ast = parser::parse(tokens).ok()?;

    // get the current predicate

    let strings = if false {
        // get the PredicateField and handle "Is" separately, with the IS_VALUES
        IS_VALUES.iter().map(|k| k.to_string()).collect()
    } else {
        // replace the current predicate with ScryfallExpr::True

        let plan = planner::build_plan(ctx, &ast).await.ok()?;

        let results = ctx.execute_logical_plan(plan).await.ok()?;

        // run that query and filter for the given value

        Vec::new()
    };
    return Some(Completion {
        start,
        end,
        strings,
    });
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
        assert!(suggestions.len() > 2); // premodern only has 2 layouts
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
        assert!(suggestions.len() > 2); // premodern only has 2 layouts
        assert!(suggestions.contains(&"normal".into())); // make sure normal is still included
    }

    #[tokio::test]
    async fn test_autocomplete_not_values() {
        let ctx = get_local_context().await.unwrap();
        let input = "format:premodern -(format:vintage name:)"; // should run the query "format:premodern" -(format:vintage) and return names
        let Completion {
            strings: mut suggestions,
            ..
        } = autocomplete(&ctx, input, input.len()).await.unwrap();
        suggestions.sort();
        assert!(suggestions == vec!["Crusade", "Pradesh Gypsies"]);
    }
}
