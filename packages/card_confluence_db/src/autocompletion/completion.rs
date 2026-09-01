use datafusion::prelude::SessionContext;

use crate::autocompletion::keywords::KEYWORDS;
use crate::autocompletion::option::{options_for_predicate, options_from_static};
use crate::autocompletion::planner::{self, find_predicate, replace_predicate_with_true};
use crate::autocompletion::{Completion, CompletionResponse};
use crate::query_parser::lexer::{self, Token, TokenKind};
use crate::query_parser::parser;

use crate::query_parser::planner::predicates::PredicateField;

fn is_subsequence<A: AsRef<str>, B: AsRef<str>>(search: &A, target: &B) -> bool {
    let mut target_iter = target.as_ref().chars();

    search.as_ref().chars().all(|s_char| {
        target_iter
            .find(|t_char| t_char.to_ascii_lowercase() == s_char.to_ascii_lowercase())
            .is_some()
    })
}

pub async fn complete(ctx: &SessionContext, input: &str, pos: usize) -> Option<CompletionResponse> {
    let mut tokens = lexer::tokenize(input).ok()?;

    let mut current_token_idx = None;
    // See if we are strictly inside any tokens
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

    // see if we are directly after a token
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
            from: pos,
            to: pos,
            options: options_from_static(KEYWORDS),
        }));
    };

    let token = &tokens[idx];

    match &token.kind {
        TokenKind::And | TokenKind::Or => {
            return Some(CompletionResponse::Completion(Completion {
                from: token.start,
                to: token.end,
                options: vec!["and".into(), "or".into()],
            }));
        }
        TokenKind::Ident(_) => {
            return Some(CompletionResponse::Completion(Completion {
                from: token.start,
                to: token.end,
                options: options_from_static(KEYWORDS),
            }));
        }
        TokenKind::Op(_) => {
            return Some(CompletionResponse::Completion(Completion {
                from: token.start,
                to: token.end,
                options: vec![
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
            if idx != 0
                && let Some(prev) = tokens.iter().nth(idx - 1)
                && matches!(prev.kind, TokenKind::Op(_))
            {
            } else {
                let val_lower = val.to_lowercase();
                if KEYWORDS.iter().any(|k| is_subsequence(&val_lower, k)) {
                    return Some(CompletionResponse::Completion(Completion {
                        from: token.start,
                        to: token.end,
                        options: options_from_static(KEYWORDS),
                    }));
                }
            };
        }
        _ => return None,
    };

    let from = token.start;
    let to = token.end;

    let ast = parser::parse(tokens.clone()).ok()?;
    let (pred, _path) = find_predicate(&ast, pos)?;
    let pred_type = PredicateField::try_from(pred.field.as_str()).ok()?;

    if let Some(options) = options_for_predicate(pred_type) {
        return Some(CompletionResponse::Completion(Completion {
            from,
            to,
            options,
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
            from,
            to,
            options: Vec::new(),
        },
        plan,
    ))
}
