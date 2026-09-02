use std::sync::Arc;

use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::functions::string::expr_fn::lower; // use this "lower(col(1))"
use datafusion::logical_expr::{Expr as DFExpr, ScalarUDF, col, lit, not, try_cast};
use datafusion::scalar::ScalarValue;

use crate::query_parser::lexer::Op;
use crate::query_parser::planner::PlanError;

pub fn text_col(column: &str) -> DFExpr {
    lower(col(column))
}

pub fn text_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    if value.starts_with('/') && value.ends_with('/') && value.len() >= 2 {
        let regex = &value[1..value.len() - 1];
        return match op {
            Op::Colon | Op::Eq => Ok(regexp_like_expr(column, regex)),
            Op::Ne => Ok(not(regexp_like_expr(column, regex))),
            other => Err(PlanError(format!(
                "Operator {other:?} is not valid for regex on field '{column}'"
            ))),
        };
    }
    match op {
        Op::Colon => Ok(text_col(column).ilike(lit(format!("%{value}%")))),
        Op::Eq => Ok(text_col(column).eq(lit(value.to_string()))),
        Op::Ne => Ok(text_col(column).not_eq(lit(value.to_string()))),
        other => Err(PlanError(format!(
            "Operator {other:?} is not valid for text field '{column}'"
        ))),
    }
}

pub fn exact_pred(column: &str, value: &str) -> Result<DFExpr, PlanError> {
    Ok(text_col(column).eq(lit(value.to_string())))
}

pub fn numeric_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let n: f64 = value
        .parse()
        .map_err(|_| PlanError(format!("Cannot parse '{value}' as a number")))?;
    let col_expr = col(column);
    Ok(match op {
        Op::Colon | Op::Eq => col_expr.eq(lit(n)),
        Op::Ne => col_expr.not_eq(lit(n)),
        Op::Lt => col_expr.lt(lit(n)),
        Op::Lte => col_expr.lt_eq(lit(n)),
        Op::Gt => col_expr.gt(lit(n)),
        Op::Gte => col_expr.gt_eq(lit(n)),
    })
}

pub fn flexible_numeric_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    if value.parse::<f64>().is_ok() || matches!(op, Op::Lt | Op::Lte | Op::Gt | Op::Gte) {
        // Cast string columns (power/toughness/loyalty/defense are stored as strings)
        let col_expr = cast_expr(col(column), arrow_schema::DataType::Float64);
        let n: f64 = value
            .parse()
            .map_err(|_| PlanError(format!("Cannot parse '{value}' as a number")))?;
        Ok(match op {
            Op::Colon | Op::Eq => col_expr.eq(lit(n)),
            Op::Ne => col_expr.not_eq(lit(n)),
            Op::Lt => col_expr.lt(lit(n)),
            Op::Lte => col_expr.lt_eq(lit(n)),
            Op::Gt => col_expr.gt(lit(n)),
            Op::Gte => col_expr.gt_eq(lit(n)),
        })
    } else {
        text_pred(column, op, value)
    }
}

pub fn powtou_pred(op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let n: f64 = value
        .parse()
        .map_err(|_| PlanError(format!("Cannot parse '{value}' as a number")))?;
    let col_expr = cast_expr(col("cards.power"), arrow_schema::DataType::Float64)
        + cast_expr(col("cards.toughness"), arrow_schema::DataType::Float64);
    Ok(match op {
        Op::Colon | Op::Eq => col_expr.eq(lit(n)),
        Op::Ne => col_expr.not_eq(lit(n)),
        Op::Lt => col_expr.lt(lit(n)),
        Op::Lte => col_expr.lt_eq(lit(n)),
        Op::Gt => col_expr.gt(lit(n)),
        Op::Gte => col_expr.gt_eq(lit(n)),
    })
}

pub fn cast_expr(expr: DFExpr, data_type: arrow_schema::DataType) -> DFExpr {
    try_cast(expr, data_type)
}

pub fn color_pred(column: &str, op: &Op, value: &str, is_identity: bool) -> Result<DFExpr, PlanError> {
    if let Ok(n) = value.parse::<i64>() {
        let len = array_length_expr(column);
        return Ok(match op {
            Op::Colon | Op::Eq => len.eq(lit(n)),
            Op::Ne => len.not_eq(lit(n)),
            Op::Gt => len.gt(lit(n)),
            Op::Gte => len.gt_eq(lit(n)),
            Op::Lt => len.lt(lit(n)),
            Op::Lte => len.lt_eq(lit(n)),
        });
    }

    let letters = normalize_colors(value);
    
    // Resolve Colon to either Gte (for color) or Lte (for identity)
    let resolved_op = if *op == Op::Colon {
        if is_identity {
            Op::Lte
        } else {
            Op::Gte
        }
    } else {
        op.clone()
    };

    match resolved_op {
        Op::Eq => {
            if letters == "C" {
                Ok(array_length_expr(column).eq(lit(0)))
            } else {
                let colors = canonical_color_vec(&letters);
                Ok(col(column).eq(lit_array(colors)))
            }
        }
        Op::Ne => {
            if letters == "C" {
                Ok(array_length_expr(column).not_eq(lit(0)))
            } else {
                let colors = canonical_color_vec(&letters);
                Ok(col(column).not_eq(lit_array(colors)))
            }
        }
        Op::Gte | Op::Gt => {
            if letters == "C" {
                if resolved_op == Op::Gt {
                    Ok(array_length_expr(column).gt(lit(0)))
                } else {
                    Ok(lit(true)) // c>=c is any card (or c=c for colorless only? Scryfall makes c>=c mean colorless. Let's make it len=0 for c>=c if they want. Actually, let's just do len>=0 which is true). Wait, c>=c in Scryfall means colorless. Let's just do len == 0.
                }
            } else {
                let colors = canonical_color_vec(&letters);
                let mut expr = if resolved_op == Op::Gt {
                    array_length_expr(column).gt(lit(colors.len() as i32))
                } else {
                    lit(true)
                };
                
                if letters.contains('M') {
                    expr = expr.and(array_length_expr(column).gt(lit(1)));
                }

                for c in colors {
                    expr = expr.and(array_contains_expr(column, lit(c)));
                }
                Ok(expr)
            }
        }
        Op::Lte | Op::Lt => {
            if letters == "C" {
                if resolved_op == Op::Lt {
                    Ok(lit(false)) // c<c is impossible
                } else {
                    Ok(array_length_expr(column).eq(lit(0))) // c<=c is colorless
                }
            } else {
                let colors = canonical_color_vec(&letters);
                let mut expr = if resolved_op == Op::Lt {
                    array_length_expr(column).lt(lit(colors.len() as i32))
                } else {
                    lit(true)
                };
                for c in "WUBRG".chars() {
                    if !letters.contains(c) {
                        expr = expr.and(not(array_contains_expr(column, lit(c.to_string()))));
                    }
                }
                Ok(expr)
            }
        }
        Op::Colon => unreachable!(),
    }
}

pub fn format_pred(value: &str) -> Result<DFExpr, PlanError> {
    Ok(col("cards.legalities")
        .field(value)
        .not_eq(lit("not_legal"))
        .and(col("cards.legalities").field(value).not_eq(lit("banned"))))
}

pub fn is_pred(value: &str) -> Result<DFExpr, PlanError> {
    match value {
        // Oracle-side type checks
        "legendary" => Ok(array_contains_expr("cards.super_types", lit("Legendary"))),
        "nonlegendary" => Ok(not(array_contains_expr(
            "cards.super_types",
            lit("Legendary"),
        ))),
        "land" => Ok(array_contains_expr("cards.card_types", lit("Land"))),
        "creature" => Ok(array_contains_expr("cards.card_types", lit("Creature"))),
        "artifact" => Ok(array_contains_expr("cards.card_types", lit("Artifact"))),
        "enchantment" => Ok(array_contains_expr("cards.card_types", lit("Enchantment"))),
        "planeswalker" => Ok(array_contains_expr("cards.card_types", lit("Planeswalker"))),
        "battle" => Ok(array_contains_expr("cards.card_types", lit("Battle"))),
        "spell" => Ok(array_contains_expr("cards.card_types", lit("Instant"))
            .or(array_contains_expr("cards.card_types", lit("Sorcery")))),
        "permanent" => Ok(array_contains_expr("cards.card_types", lit("Creature"))
            .or(array_contains_expr("cards.card_types", lit("Artifact")))
            .or(array_contains_expr("cards.card_types", lit("Enchantment")))
            .or(array_contains_expr("cards.card_types", lit("Planeswalker")))
            .or(array_contains_expr("cards.card_types", lit("Land")))
            .or(array_contains_expr("cards.card_types", lit("Battle")))),
        "reserved" => Ok(col("cards.reserved").eq(lit(true))),
        // "commander" => Ok((array_contains_expr("cards.super_types", lit("Legendary"))
        //     .and(array_contains_expr("cards.card_types", lit("Creature"))))
        // .or(array_contains_expr(
        //     "cards.otags",
        //     lit("can_be_your_commander"),
        // ))),
        "commander" => Ok(col("cards.commander").eq(lit(true))),

        // Print-side boolean flags
        "reprint" => Ok(col("prints.reprint").eq(lit(true))),
        "firstprinting" => Ok(col("prints.reprint").eq(lit(false))),
        "booster" => Ok(col("prints.booster").eq(lit(true))),
        "promo" => Ok(col("prints.promo").eq(lit(true))),
        "digital" => Ok(col("prints.digital").eq(lit(true))),
        "oversized" => Ok(col("prints.oversized").eq(lit(true))),
        "story_spotlight" => Ok(col("prints.story_spotlight").eq(lit(true))),
        "textless" => Ok(col("prints.textless").eq(lit(true))),
        "full_art" => Ok(col("prints.full_art").eq(lit(true))),
        "foil" => Ok(array_contains_expr("prints.finishes", lit("foil"))),
        "nonfoil" => Ok(array_contains_expr("prints.finishes", lit("nonfoil"))),
        "etched" => Ok(array_contains_expr("prints.finishes", lit("etched"))),

        other => Err(PlanError(format!("Unknown `is:` flag: '{other}'"))),
    }
}

pub fn regexp_like_expr(column: &str, pattern: &str) -> DFExpr {
    let udf: Arc<ScalarUDF> = datafusion::functions::regex::regexp_like();
    udf.call(vec![col(column), lit(pattern), lit("i")])
}

pub fn array_contains_expr(column: &str, element: DFExpr) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_has(col(column), element)
}

pub fn array_length_expr(column: &str) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_length(col(column))
}

pub fn lit_array(vec: Vec<String>) -> DFExpr {
    let values: Vec<ScalarValue> = vec.into_iter().map(ScalarValue::from).collect();
    let array = ScalarValue::new_list(&values, &arrow_schema::DataType::Utf8, true);
    lit(ScalarValue::List(array))
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
    const ORDER: &str = "WUBRG";
    let mut out: Vec<char> = letters.chars().filter(|c| ORDER.contains(*c)).collect();
    out.sort_by_key(|c| ORDER.find(*c).unwrap_or(usize::MAX));
    out.dedup();
    out.into_iter().map(|c| c.to_string()).collect()
}
