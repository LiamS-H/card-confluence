use std::sync::Arc;

use datafusion::common::DFSchema;

use datafusion::logical_expr::{
    col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder, ScalarUDF,
};
use datafusion::prelude::{JoinType, SessionContext};

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
    let needs_set_join = references_set_table(expr);

    let base_plan = if needs_set_join {
        let cards_df = ctx.table("cards").await?;
        let sets_df = ctx.table("sets").await?;
        cards_df
            .join(sets_df, JoinType::Inner, &["set_code"], &["code"], None)?
            .into_unoptimized_plan()
    } else {
        ctx.table("cards").await?.into_unoptimized_plan()
    };

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
/// Colors are stored as comma-separated WUBRG letters, e.g. `"W,U"`.
///
/// | Query    | Meaning                                             |
/// |----------|-----------------------------------------------------|
/// | `c:blue` | colors contains U  (ilike '%U%')                    |
/// | `c:WU`   | colors contains W AND contains U                    |
/// | `c:C`    | colorless — colors is empty or NULL                 |
/// | `c=WU`   | exact identity — WUBRG-ordered string equality      |
/// | `c!=WU`  | not that exact identity                             |
/// | `c>=2`   | at least 2 colors (regexp_like comma-count)         |
///
/// For numeric color-count comparisons we emit `regexp_like` nodes so the
/// entire expression lives inside DataFusion's typed `Expr` tree and the
/// optimizer can reason about it (e.g. constant-fold impossible predicates).
fn color_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let letters = normalize_colors(value);

    match op {
        Op::Colon => {
            if letters == "C" {
                return Ok(col(column).eq(lit("")).or(col(column).is_null()));
            }
            // AND together one ilike per required color letter.
            letters
                .chars()
                .map(|c| Ok(col(column).ilike(lit(format!("%{c}%")))))
                .reduce(|a, b| Ok(a?.and(b?)))
                .unwrap_or_else(|| Err(PlanError("Empty color value".into())))
        }

        Op::Eq => Ok(col(column).eq(lit(canonical_color_string(&letters)))),
        Op::Ne => Ok(col(column).not_eq(lit(canonical_color_string(&letters)))),

        // Numeric color-count: c>=2 → "at least 2 colors".
        //
        // Colors is comma-separated, so N colors = N-1 commas.
        // We count commas via regexp_like rather than a string-length function
        // so the expression stays a typed ScalarFunction node that DataFusion
        // can push down, constant-fold, and CSE-eliminate.
        //
        // "at least k commas" pattern: `(.*,){k}`
        // "at most k commas"  pattern: NOT `(.*,){k+1}`
        Op::Gt | Op::Gte | Op::Lt | Op::Lte => {
            let n: i64 = value
                .parse()
                .map_err(|_| PlanError(format!("Cannot parse '{value}' as a color count")))?;

            // Map the operator to (min_commas, max_commas) bounds.
            let (min_commas, max_commas): (Option<i64>, Option<i64>) = match op {
                Op::Gt => (Some(n), None),      // > n colors  → ≥ n commas
                Op::Gte => (Some(n - 1), None), // ≥ n colors  → ≥ n-1 commas
                Op::Lt => (None, Some(n - 2)),  // < n colors  → ≤ n-2 commas
                Op::Lte => (None, Some(n - 1)), // ≤ n colors  → ≤ n-1 commas
                _ => unreachable!(),
            };

            let mut expr: Option<DFExpr> = None;

            if let Some(min) = min_commas {
                if min > 0 {
                    // regexp_like(col, "(.*,){min}") — has at least `min` commas
                    let pat = format!("(.*,){{{min}}}");
                    expr = Some(and_opt(expr, regexp_like_expr(column, &pat)));
                }
                // min == 0 → trivially true, add nothing
            }

            if let Some(max) = max_commas {
                if max < 0 {
                    // Impossible (e.g. c<1 when min colors is 0): always false
                    return Ok(lit(false));
                }
                // NOT regexp_like(col, "(.*,){max+1}") — has fewer than max+1 commas
                let pat = format!("(.*,){{{}}}", max + 1);
                expr = Some(and_opt(expr, not(regexp_like_expr(column, &pat))));
            }

            Ok(expr.unwrap_or(lit(true)))
        }
    }
}

/// Call DataFusion's built-in `regexp_like(col, pattern)` scalar function.
///
/// We call into `datafusion::functions::regex::regexplike` directly, which
/// registers the function as a `ScalarFunction` node in the logical plan.
/// This is preferred over going through SQL text because:
///   1. No re-parsing overhead.
///   2. The optimizer sees the concrete `ScalarUDF` and can apply
///      function-specific rewrites (e.g. constant-pattern folding).
///   3. The physical planner can use the compiled regex cache.
fn regexp_like_expr(column: &str, pattern: &str) -> DFExpr {
    let udf: Arc<ScalarUDF> = datafusion::functions::regex::regexp_like();

    udf.call(vec![col(column), lit(pattern)])
}

/// AND a new expression into an accumulator, returning the new expression
/// standalone if the accumulator is empty.
#[inline]
fn and_opt(acc: Option<DFExpr>, new: DFExpr) -> DFExpr {
    match acc {
        None => new,
        Some(e) => e.and(new),
    }
}

// ---------------------------------------------------------------------------
// Format legality
// ---------------------------------------------------------------------------

/// Filter cards legal in a given format.
///
/// `legalities` is a JSON string: `{"standard":"legal","modern":"not_legal",...}`.
/// We use `regexp_like` so DataFusion holds a `ScalarFunction` node (not a
/// raw LIKE string) and can compile the pattern once across batches.
fn format_pred(value: &str) -> Result<DFExpr, PlanError> {
    let pattern = format!(r#""{}":"legal""#, regex_escape(&value.to_lowercase()));
    Ok(regexp_like_expr("legalities", &pattern))
}

// ---------------------------------------------------------------------------
// Boolean `is:` flags
// ---------------------------------------------------------------------------

fn is_pred(value: &str) -> Result<DFExpr, PlanError> {
    match value.to_lowercase().as_str() {
        "legendary" => Ok(col("is_legendary").eq(lit(true))),
        "nonlegendary" => Ok(col("is_legendary").eq(lit(false))),

        // ilike produces a typed `Like { case_insensitive: true }` node that
        // DataFusion can push into scans.
        "land" => Ok(col("type_line").ilike(lit("%Land%"))),
        "creature" => Ok(col("type_line").ilike(lit("%Creature%"))),
        "artifact" => Ok(col("type_line").ilike(lit("%Artifact%"))),
        "enchantment" => Ok(col("type_line").ilike(lit("%Enchantment%"))),
        "planeswalker" => Ok(col("type_line").ilike(lit("%Planeswalker%"))),
        "battle" => Ok(col("type_line").ilike(lit("%Battle%"))),

        "spell" => Ok(col("type_line")
            .ilike(lit("%Instant%"))
            .or(col("type_line").ilike(lit("%Sorcery%")))),

        "permanent" => Ok(col("type_line")
            .ilike(lit("%Creature%"))
            .or(col("type_line").ilike(lit("%Artifact%")))
            .or(col("type_line").ilike(lit("%Enchantment%")))
            .or(col("type_line").ilike(lit("%Planeswalker%")))
            .or(col("type_line").ilike(lit("%Land%")))
            .or(col("type_line").ilike(lit("%Battle%")))),

        other => Err(PlanError(format!("Unknown `is:` flag: '{other}'"))),
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

fn normalize_colors(value: &str) -> String {
    match value.to_lowercase().as_str() {
        "white" => "W".into(),
        "blue" => "U".into(),
        "black" => "B".into(),
        "red" => "R".into(),
        "green" => "G".into(),
        "colorless" | "c" => "C".into(),
        "multicolor" | "m" => "M".into(),
        other => other.to_uppercase(),
    }
}

/// Sort color letters into WUBRG canonical order for exact-match comparisons.
fn canonical_color_string(letters: &str) -> String {
    const ORDER: &str = "WUBRG";
    let mut out: Vec<char> = letters.chars().filter(|c| ORDER.contains(*c)).collect();
    out.sort_by_key(|c| ORDER.find(*c).unwrap_or(usize::MAX));
    out.dedup();
    out.into_iter().collect()
}

/// Escape special regex metacharacters in a user-supplied value.
fn regex_escape(s: &str) -> String {
    s.chars()
        .flat_map(|c| {
            if r"\.+*?()|[]{}^$#&-~".contains(c) {
                vec!['\\', c]
            } else {
                vec![c]
            }
        })
        .collect()
}

/// Walk the AST and report whether any predicate needs the `sets` table.
fn references_set_table(expr: &ScryfallExpr) -> bool {
    match expr {
        ScryfallExpr::Predicate(p) => matches!(
            p.field.as_str(),
            "s" | "set" | "e" | "edition" | "st" | "settype"
        ),
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            references_set_table(l) || references_set_table(r)
        }
        ScryfallExpr::Not(inner) => references_set_table(inner),
    }
}
