use std::sync::Arc;

use datafusion::common::DFSchema;

use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::logical_expr::{
    col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder, ScalarUDF,
};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;

use crate::query_parser::lexer::Op;
use crate::query_parser::parser::{Predicate, ScryfallExpr};

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

pub async fn build_plan(
    ctx: &SessionContext,
    expr: &ScryfallExpr,
) -> Result<LogicalPlan, PlanError> {
    let mut df = ctx.table("cards").await?;

    let needs_print = references_print_fields(expr) || references_set_table(expr);
    let needs_set = references_set_table(expr);

    if needs_print {
        df = df.unnest_columns(&["prints"])?;
        // Project commonly used fields from the prints struct
        df = df.with_column("set_code", col("prints").field("set_code"))?;
        df = df.with_column("rarity", col("prints").field("rarity"))?;
        df = df.with_column("collector_number", col("prints").field("collector_number"))?;
        // Artist is inside illustrations list, take first one
        let illustrations = col("prints").field("illustrations");
        df = df.with_column("artist", get_element_expr(illustrations, 1).field("artist"))?;
    }

    if needs_set {
        let sets_df = ctx.table("sets").await?;
        df = df.join(sets_df, JoinType::Inner, &["set_code"], &["code"], None)?;
    }

    let base_plan = df.into_unoptimized_plan();
    let schema = base_plan.schema().clone();
    let filter_expr = expr_to_df_expr(expr, &schema)?;

    let plan = LogicalPlanBuilder::from(base_plan)
        .filter(filter_expr)?
        .build()?;

    Ok(plan)
}

fn expr_to_df_expr(expr: &ScryfallExpr, schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(pred) => predicate_to_df_expr(pred, schema),
        ScryfallExpr::And(l, r) => Ok(expr_to_df_expr(l, schema)?.and(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Or(l, r) => Ok(expr_to_df_expr(l, schema)?.or(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Not(inner) => Ok(not(expr_to_df_expr(inner, schema)?)),
    }
}

fn predicate_to_df_expr(pred: &Predicate, _schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match pred.field.as_str() {
        "name" | "n" => text_pred("name", &pred.op, &pred.value),
        "type" | "t" => text_pred("type_line", &pred.op, &pred.value),
        "oracle" | "o" => text_pred("oracle_text", &pred.op, &pred.value),
        "mana" | "m" => text_pred("mana_cost", &pred.op, &pred.value),
        "pow" | "power" => text_pred("power", &pred.op, &pred.value),
        "tou" | "toughness" => text_pred("toughness", &pred.op, &pred.value),
        "loy" | "loyalty" => text_pred("loyalty", &pred.op, &pred.value),
        "a" | "artist" => text_pred("artist", &pred.op, &pred.value),
        "color" | "c" => color_pred("colors", &pred.op, &pred.value),
        "identity" | "ci" | "id" => color_pred("color_identity", &pred.op, &pred.value),
        "cmc" | "mv" | "manavalue" => numeric_pred("cmc", &pred.op, &pred.value),
        "cn" | "number" => exact_pred("collector_number", &pred.value),
        "r" | "rarity" => exact_pred("rarity", &pred.value),
        "st" | "settype" => exact_pred("set_type", &pred.value),
        "f" | "format" => format_pred(&pred.value),
        "is" => is_pred(&pred.value),

        "otag" | "oracle_tag" => Ok(array_contains_expr("otags", lit(pred.value.to_lowercase()))),
        "kw" | "keyword" => Ok(array_contains_expr(
            "keywords",
            lit(pred.value.to_lowercase()),
        )),

        "s" | "set" | "e" | "edition" => {
            // Short alphanumeric codes (≤4 chars) match set_code directly;
            // longer strings are treated as a partial set name match.
            if pred.value.len() <= 4 && pred.value.chars().all(|c| c.is_alphanumeric()) {
                Ok(col("set_code").eq(lit(pred.value.to_lowercase())))
            } else {
                text_pred("sets.name", &pred.op, &pred.value)
            }
        }

        unknown => Err(PlanError(format!("Unknown Scryfall field: '{unknown}'"))),
    }
}

fn text_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
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
        Op::Colon => Ok(col(column).ilike(lit(format!("%{value}%")))),
        Op::Eq => Ok(col(column).eq(lit(value.to_string()))),
        Op::Ne => Ok(col(column).not_eq(lit(value.to_string()))),
        other => Err(PlanError(format!(
            "Operator {other:?} is not valid for text field '{column}'"
        ))),
    }
}

fn exact_pred(column: &str, value: &str) -> Result<DFExpr, PlanError> {
    Ok(col(column).eq(lit(value.to_lowercase())))
}

fn numeric_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let n: f64 = value
        .parse()
        .map_err(|_| PlanError(format!("Cannot parse '{value}' as a number")))?;
    Ok(match op {
        Op::Colon | Op::Eq => col(column).eq(lit(n)),
        Op::Ne => col(column).not_eq(lit(n)),
        Op::Lt => col(column).lt(lit(n)),
        Op::Lte => col(column).lt_eq(lit(n)),
        Op::Gt => col(column).gt(lit(n)),
        Op::Gte => col(column).gt_eq(lit(n)),
    })
}

// ---------------------------------------------------------------------------
// Color predicates
// ---------------------------------------------------------------------------

/// Build a color / color-identity filter.
///
/// Colors are now stored as a list of strings, e.g. `["W", "U"]`.
fn color_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let letters = normalize_colors(value);

    match op {
        Op::Colon => {
            if letters == "C" {
                return Ok(array_length_expr(column).eq(lit(0)));
            }
            // AND together array_contains for each required color letter.
            letters
                .chars()
                .map(|c| {
                    if c == 'M' {
                        Ok(array_length_expr(column).gt(lit(1)))
                    } else {
                        Ok(array_contains_expr(column, lit(c.to_string())))
                    }
                })
                .reduce(|a, b| Ok(a?.and(b?)))
                .unwrap_or_else(|| Err(PlanError("Empty color value".into())))
        }

        Op::Eq => {
            let colors = canonical_color_vec(&letters);
            Ok(col(column).eq(lit_array(colors)))
        }
        Op::Ne => {
            let colors = canonical_color_vec(&letters);
            Ok(col(column).not_eq(lit_array(colors)))
        }

        Op::Gt | Op::Gte | Op::Lt | Op::Lte => {
            let n: i64 = value
                .parse()
                .map_err(|_| PlanError(format!("Cannot parse '{value}' as a color count")))?;

            let len = array_length_expr(column);
            Ok(match op {
                Op::Gt => len.gt(lit(n)),
                Op::Gte => len.gt_eq(lit(n)),
                Op::Lt => len.lt(lit(n)),
                Op::Lte => len.lt_eq(lit(n)),
                _ => unreachable!(),
            })
        }
    }
}

/// Call DataFusion's built-in `regexp_like(col, pattern, flags)` scalar function.
fn regexp_like_expr(column: &str, pattern: &str) -> DFExpr {
    let udf: Arc<ScalarUDF> = datafusion::functions::regex::regexp_like();
    // Use 'i' flag for case-insensitive matching by default
    udf.call(vec![col(column), lit(pattern), lit("i")])
}

fn array_contains_expr(column: &str, element: DFExpr) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_has(col(column), element)
}

fn array_length_expr(column: &str) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_length(col(column))
}

fn get_element_expr(array: DFExpr, index: i64) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_element(array, lit(index))
}

fn lit_array(vec: Vec<String>) -> DFExpr {
    let values: Vec<ScalarValue> = vec.into_iter().map(ScalarValue::from).collect();
    let array = ScalarValue::new_list(&values, &arrow_schema::DataType::Utf8, true);
    lit(ScalarValue::List(array))
}

// ---------------------------------------------------------------------------
// Format legality
// ---------------------------------------------------------------------------

/// Filter cards legal in a given format.
fn format_pred(value: &str) -> Result<DFExpr, PlanError> {
    let format = value.to_lowercase();
    Ok(col("legalities").field(format).eq(lit("legal")))
}

// ---------------------------------------------------------------------------
// Boolean `is:` flags
// ---------------------------------------------------------------------------

fn is_pred(value: &str) -> Result<DFExpr, PlanError> {
    match value.to_lowercase().as_str() {
        "legendary" => Ok(array_contains_expr("super_types", lit("Legendary"))),
        "nonlegendary" => Ok(not(array_contains_expr("super_types", lit("Legendary")))),

        "land" => Ok(array_contains_expr("card_types", lit("Land"))),
        "creature" => Ok(array_contains_expr("card_types", lit("Creature"))),
        "artifact" => Ok(array_contains_expr("card_types", lit("Artifact"))),
        "enchantment" => Ok(array_contains_expr("card_types", lit("Enchantment"))),
        "planeswalker" => Ok(array_contains_expr("card_types", lit("Planeswalker"))),
        "battle" => Ok(array_contains_expr("card_types", lit("Battle"))),

        "spell" => Ok(array_contains_expr("card_types", lit("Instant"))
            .or(array_contains_expr("card_types", lit("Sorcery")))),

        "permanent" => Ok(array_contains_expr("card_types", lit("Creature"))
            .or(array_contains_expr("card_types", lit("Artifact")))
            .or(array_contains_expr("card_types", lit("Enchantment")))
            .or(array_contains_expr("card_types", lit("Planeswalker")))
            .or(array_contains_expr("card_types", lit("Land")))
            .or(array_contains_expr("card_types", lit("Battle")))),

        other => Err(PlanError(format!("Unknown `is:` flag: '{other}'"))),
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

fn normalize_colors(value: &str) -> String {
    let colors = match value.to_lowercase().as_str() {
        "white" => "W".into(),
        "blue" => "U".into(),
        "black" => "B".into(),
        "red" => "R".into(),
        "green" => "G".into(),
        "colorless" | "c" => "C".into(),
        "multicolor" | "m" => "M".into(),
        other => other.to_uppercase(),
    };
    return colors.chars().filter(|c| "WUBRGCM".contains(*c)).collect();
}

/// Sort color letters into WUBRG canonical order.
fn canonical_color_vec(letters: &str) -> Vec<String> {
    const ORDER: &str = "WUBRG";
    let mut out: Vec<char> = letters.chars().filter(|c| ORDER.contains(*c)).collect();
    out.sort_by_key(|c| ORDER.find(*c).unwrap_or(usize::MAX));
    out.dedup();
    out.into_iter().map(|c| c.to_string()).collect()
}

/// Walk the AST and report whether any predicate needs the `sets` table.
fn references_set_table(expr: &ScryfallExpr) -> bool {
    match expr {
        ScryfallExpr::Predicate(p) => {
            let field = p.field.as_str();
            if field == "st" || field == "settype" {
                return true;
            }
            if matches!(field, "s" | "set" | "e" | "edition") {
                // If value is long or has spaces, it's a set name match -> needs join
                return p.value.len() > 4
                    || p.value.contains(' ')
                    || !p.value.chars().all(|c| c.is_alphanumeric());
            }
            false
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            references_set_table(l) || references_set_table(r)
        }
        ScryfallExpr::Not(inner) => references_set_table(inner),
    }
}

fn references_print_fields(expr: &ScryfallExpr) -> bool {
    match expr {
        ScryfallExpr::Predicate(p) => matches!(
            p.field.as_str(),
            "a" | "artist" | "cn" | "number" | "r" | "rarity" | "s" | "set" | "e" | "edition"
        ),
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            references_print_fields(l) || references_print_fields(r)
        }
        ScryfallExpr::Not(inner) => references_print_fields(inner),
    }
}
