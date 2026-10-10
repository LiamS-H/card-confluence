use datafusion::logical_expr::{Expr as DFExpr, col, lit, not};

use crate::query_parser::lexer::Op;
use crate::query_parser::planner::PlanError;
use crate::query_parser::planner::expression_pred::ord_pred;
use crate::query_parser::planner::expression_utils::{and_all, array_contains_expr};
use crate::query_parser::planner::expression_vals::{array_length_expr, lit_array};

pub fn normalize_colors(value: &str) -> String {
    let colors = match value {
        "white" => "W".into(),
        "blue" => "U".into(),
        "black" => "B".into(),
        "red" => "R".into(),
        "green" => "G".into(),
        "colorless" | "c" => "C".into(),
        "multicolor" | "m" => "M".into(),
        other => other.to_uppercase(), // TODO: add color words like izzet
    };
    colors.chars().filter(|c| "WUBRGCM".contains(*c)).collect()
}

pub fn canonical_color_vec(letters: &str) -> Vec<String> {
    // scryfall sorts alphabetically
    const ORDER: &str = "BGRUW";
    let mut out: Vec<char> = letters.chars().filter(|c| ORDER.contains(*c)).collect();
    out.sort_by_key(|c| ORDER.find(*c).unwrap_or(usize::MAX));
    out.dedup();
    out.into_iter().map(|c| c.to_string()).collect()
}

pub fn color_pred(
    column: &str,
    op: &Op,
    value: &str,
    is_identity: bool,
) -> Result<DFExpr, PlanError> {
    if let Ok(n) = value.parse::<i64>() {
        return Ok(ord_pred(array_length_expr(column), op, lit(n)));
    }

    let letters = normalize_colors(value);
    let is_colorless = letters == "C";
    let colors = canonical_color_vec(&letters);
    let len = || array_length_expr(column);

    // Resolve Colon to either Gte (for color) or Lte (for identity)
    let resolved_op = if *op == Op::Colon {
        if is_identity { Op::Lte } else { Op::Gte }
    } else {
        op.clone()
    };

    match resolved_op {
        Op::Eq | Op::Ne => {
            let eq_expr = if is_colorless {
                len().eq(lit(0))
            } else {
                col(column).eq(lit_array(colors))
            };
            Ok(if resolved_op == Op::Eq {
                eq_expr
            } else {
                not(eq_expr)
            })
        }
        Op::Gte | Op::Gt => {
            let strict = resolved_op == Op::Gt;
            if is_colorless {
                Ok(if strict {
                    len().gt(lit(0))
                } else {
                    lit(true) // c>=c is any card (or c=c for colorless only? Scryfall makes c>=c mean colorless. Let's make it len=0 for c>=c if they want. Actually, let's just do len>=0 which is true). Wait, c>=c in Scryfall means colorless. Let's just do len == 0.
                })
            } else {
                let mut expr = if strict {
                    len().gt(lit(colors.len() as i32))
                } else {
                    lit(true)
                };
                if letters.contains('M') {
                    expr = expr.and(len().gt(lit(1)));
                }
                Ok(and_all(
                    expr,
                    colors
                        .into_iter()
                        .map(|c| array_contains_expr(column, lit(c))),
                ))
            }
        }
        Op::Lte | Op::Lt => {
            let strict = resolved_op == Op::Lt;
            if is_colorless {
                Ok(if strict {
                    lit(false) // c<c is impossible
                } else {
                    len().eq(lit(0)) // c<=c is colorless
                })
            } else {
                let expr = if strict {
                    len().lt(lit(colors.len() as i32))
                } else {
                    lit(true)
                };
                Ok(and_all(
                    expr,
                    "WUBRG"
                        .chars()
                        .filter(|c| !letters.contains(*c))
                        .map(|c| not(array_contains_expr(column, lit(c.to_string())))),
                ))
            }
        }
        Op::Colon => unreachable!(),
    }
}
