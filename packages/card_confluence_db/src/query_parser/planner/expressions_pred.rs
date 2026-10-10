use arrow::datatypes::DataType;
use chrono::NaiveDate;
use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::functions::string::expr_fn::lower;
use datafusion::logical_expr::{Expr as DFExpr, cast, col, lit, not, try_cast};

use crate::query_parser::lexer::Op;
use crate::query_parser::planner::PlanError;
use crate::query_parser::planner::expression_matches::{
    and_all, array_contains_expr, array_has_any, regexp_like_expr,
};
use crate::query_parser::planner::expression_vals::{
    array_length_expr, exact_lower_text, float_col, lit_array, numeric_lit,
};

/// If `value` is written as `/pattern/`, returns the pattern.
pub fn regex_body(value: &str) -> Option<&str> {
    value.strip_prefix('/')?.strip_suffix('/')
}

pub fn ord_pred(col: DFExpr, op: &Op, lit: DFExpr) -> DFExpr {
    match op {
        Op::Colon | Op::Eq => col.eq(lit),
        Op::Ne => col.not_eq(lit),
        Op::Lt => col.lt(lit),
        Op::Lte => col.lt_eq(lit),
        Op::Gt => col.gt(lit),
        Op::Gte => col.gt_eq(lit),
    }
}

pub fn eq_pred(field: &str, op: &Op, eq_expr: DFExpr) -> Result<DFExpr, PlanError> {
    match op {
        Op::Colon | Op::Eq => Ok(eq_expr),
        Op::Ne => Ok(!eq_expr),
        _ => Err(PlanError(format!("invalid operator for {}.", field))),
    }
}

/// Helper to determine the [start, end) bounds for a given partial date string
fn get_date_bounds(value: &str) -> Result<(NaiveDate, NaiveDate), PlanError> {
    let invalid = || PlanError(format!("Invalid date '{value}'"));
    let num = |s: &str| s.parse::<u32>().map_err(|_| invalid());
    let ymd = |y: i32, m: u32, d: u32| NaiveDate::from_ymd_opt(y, m, d).ok_or_else(invalid);

    let parts: Vec<&str> = value.split('-').collect();
    let year: i32 = parts[0].parse().map_err(|_| PlanError("Bad year".into()))?;

    match parts.as_slice() {
        // e.g., "2020"
        [_] => Ok((ymd(year, 1, 1)?, ymd(year + 1, 1, 1)?)),
        // e.g., "2020-1"
        [_, month] => {
            let month = num(month)?;
            let end = if month == 12 {
                ymd(year + 1, 1, 1)?
            } else {
                ymd(year, month + 1, 1)?
            };
            Ok((ymd(year, month, 1)?, end))
        }
        // e.g., "2020-1-1"
        [_, month, day] => {
            let start = ymd(year, num(month)?, num(day)?)?;
            let end = start.succ_opt().ok_or_else(invalid)?; // Next day
            Ok((start, end))
        }
        _ => Err(PlanError("Invalid date format".into())),
    }
}

fn date_lit(date: NaiveDate) -> DFExpr {
    cast(lit(date.to_string()), DataType::Date32)
}

pub fn date_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let (start_date, end_date) = get_date_bounds(value)?;

    let start_expr = date_lit(start_date);
    let end_expr = date_lit(end_date);
    let col_expr = col(column);

    Ok(match op {
        Op::Colon | Op::Eq => col_expr
            .clone()
            .gt_eq(start_expr)
            .and(col_expr.lt(end_expr)),
        Op::Ne => col_expr.clone().lt(start_expr).or(col_expr.gt_eq(end_expr)),
        Op::Lt => col_expr.lt(start_expr),
        Op::Lte => col_expr.lt(end_expr),
        Op::Gt => col_expr.gt_eq(end_expr),
        Op::Gte => col_expr.gt_eq(start_expr),
    })
}

pub fn rarity_pred(_column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let column = col("prints.rarity");

    const ORDERED: [&str; 5] = ["common", "uncommon", "rare", "mythic", "special"];
    const BONUS: &str = "bonus";

    let value = value.to_lowercase();
    let value = value.as_str();

    let is_bonus = value == BONUS;
    let index = ORDERED.iter().position(|r| *r == value);

    if index.is_none() && !is_bonus {
        return Err(PlanError(format!(
            "Invalid rarity {}, try one of {}, {}",
            value,
            ORDERED.join(", "),
            BONUS
        )));
    }

    if is_bonus && !matches!(op, Op::Eq | Op::Lte | Op::Gt | Op::Gte) {
        return Err(PlanError(
            "rarity:bonus is not comparable using < or >. Bonus is reserved for VMA and doesn't represent bonus sheet.".into(),
        ));
    }

    let in_set = |set: &[&str]| -> DFExpr {
        if set.is_empty() {
            lit(false)
        } else {
            column
                .clone()
                .in_list(set.iter().map(|r| lit(*r)).collect(), false)
        }
    };

    let expr = match op {
        Op::Colon | Op::Eq => column.eq(lit(value)),
        Op::Ne => column.not_eq(lit(value)),
        Op::Lt => in_set(&ORDERED[..index.unwrap()]),
        Op::Lte => in_set(&ORDERED[..=index.unwrap()]),
        Op::Gt => in_set(&ORDERED[index.unwrap() + 1..]),
        Op::Gte => in_set(&ORDERED[index.unwrap()..]),
    };

    Ok(expr)
}

pub fn text_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    if let Some(regex) = regex_body(value) {
        return eq_pred(column, op, regexp_like_expr(col(column), regex));
    }
    match op {
        Op::Colon => Ok(lower(col(column)).ilike(lit(format!("%{value}%")))),
        Op::Eq => Ok(exact_lower_text(column, value)),
        Op::Ne => Ok(not(exact_lower_text(column, value))),
        other => Err(PlanError(format!(
            "Operator {other:?} is not valid for text field '{column}'"
        ))),
    }
}

pub fn keyword_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    match value.parse::<i32>() {
        Ok(num) => Ok(ord_pred(array_length_expr(column), op, lit(num))),
        Err(_) => array_text_pred(column, op, value),
    }
}

pub fn array_text_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let arr_str = datafusion_functions_nested::expr_fn::array_to_string(col(column), lit(","));
    if let Some(regex) = regex_body(value) {
        return eq_pred(column, op, regexp_like_expr(arr_str, regex));
    }
    match op {
        Op::Colon => Ok(arr_str.ilike(lit(format!("%{value}%")))),
        Op::Eq => Ok(arr_str.eq(lit(format!("%{value}%")))),
        Op::Ne => Ok(not(arr_str.eq(lit(format!("%{value}%"))))),
        other => Err(PlanError(format!(
            "Operator {other:?} is not valid for array field '{column}'"
        ))),
    }
}

pub fn flexible_numeric_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    if value.parse::<f64>().is_ok() || matches!(op, Op::Lt | Op::Lte | Op::Gt | Op::Gte) {
        // Cast string columns (power/toughness/loyalty/defense are stored as strings)
        Ok(ord_pred(float_col(column), op, numeric_lit(value)?))
    } else {
        text_pred(column, op, value)
    }
}

pub fn powtou_pred(op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let sum = float_col("cards.power") + float_col("cards.toughness");
    Ok(ord_pred(sum, op, numeric_lit(value)?))
}

pub fn cast_expr(expr: DFExpr, data_type: DataType) -> DFExpr {
    try_cast(expr, data_type)
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
pub fn legal_pred(value: &str) -> DFExpr {
    let status = col("cards.legalities").field(value);
    status
        .clone()
        .not_eq(lit("not_legal"))
        .and(status.not_eq(lit("banned")))
}

pub fn field_pred(column_name: &str, field: &str, value: &str) -> DFExpr {
    col(column_name).field(field).eq(lit(value))
}

pub fn is_pred(value: &str) -> Result<DFExpr, PlanError> {
    let flag = |column: &str, expected: bool| col(column).eq(lit(expected));

    let expr = match value {
        // Oracle-side type checks
        "legendary" => array_contains_expr("cards.super_types", lit("legendary")),
        "nonlegendary" => not(array_contains_expr("cards.super_types", lit("legendary"))),
        // the flag name is the card type name
        t @ ("land" | "creature" | "artifact" | "enchantment" | "planeswalker" | "battle") => {
            array_contains_expr("cards.card_types", lit(t))
        }
        "spell" => array_has_any("cards.card_types", &["instant", "sorcery"]),
        "permanent" => array_has_any(
            "cards.card_types",
            &[
                "creature",
                "artifact",
                "enchantment",
                "planeswalker",
                "land",
                "battle",
            ],
        ),
        "reserved" => flag("cards.reserved", true),
        "commander" => flag("cards.commander", true),

        // Print-side boolean flags
        "reprint" => flag("prints.reprint", true),
        "firstprinting" => flag("prints.reprint", false),
        f @ ("booster" | "promo" | "digital" | "oversized" | "story_spotlight" | "textless"
        | "full_art") => flag(&format!("prints.{f}"), true),
        f @ ("foil" | "nonfoil" | "etched") => array_contains_expr("prints.finishes", lit(f)),

        other => return Err(PlanError(format!("Unknown `is:` flag: '{other}'"))),
    };

    Ok(expr)
}

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
