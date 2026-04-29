use std::sync::Arc;

use datafusion::common::metadata::FieldMetadata;
use datafusion::common::DFSchema;
use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::functions::expr_fn::named_struct;
use datafusion::functions_aggregate::expr_fn::array_agg;
use datafusion::logical_expr::Expr;
use datafusion::logical_expr::{
    col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder, ScalarUDF,
};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;

use crate::query_parser::lexer::Op;
use crate::query_parser::parser::{Predicate, ScryfallExpr};
use crate::query_parser::predicates::PredicateField;

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
    let needs_set = references_set_table(expr);
    let cards_plan = ctx.table("cards").await?.into_unoptimized_plan();
    let prints_table = ctx.table("prints").await?;
    let prints_schema = prints_table.schema().clone(); // DFSchemaRef — grab before consuming
    let prints_plan = prints_table.into_unoptimized_plan();
    let (oracle_expr, _print_expr) = split_expr(expr)?;

    let filtered_cards_plan = {
        let mut builder = LogicalPlanBuilder::from(cards_plan);
        if let Some(ref of) = oracle_expr {
            let schema = builder.schema().clone();
            builder = builder.filter(expr_to_df_expr(of, &schema)?)?;
        }
        builder.build()?
    };

    let base_joined_plan = {
        let mut builder = LogicalPlanBuilder::from(filtered_cards_plan.clone()).join(
            prints_plan,
            JoinType::Inner,
            (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
            None,
        )?;
        if needs_set {
            let sets_plan = ctx.table("sets").await?.into_unoptimized_plan();
            builder = builder.join(
                sets_plan,
                JoinType::Inner,
                (vec!["prints.set_code"], vec!["sets.code"]),
                None,
            )?;
        }
        builder.build()?
    };

    // Pack each prints row into a struct dynamically, then array_agg it
    let print_struct = prints_as_struct(&prints_schema);

    let all_prints_plan = LogicalPlanBuilder::from(base_joined_plan.clone())
        .aggregate(
            oracle_group_cols(),
            vec![array_agg(print_struct.clone()).alias("all_prints")],
        )?
        .build()?;

    let matched_prints_plan = {
        let schema = base_joined_plan.schema().clone();
        let filter = expr_to_df_expr(expr, &schema)?;
        LogicalPlanBuilder::from(base_joined_plan)
            .filter(filter)?
            .aggregate(
                vec![col("cards.oracle_id").alias("matched_oracle_id")],
                vec![array_agg(print_struct).alias("matched_prints")],
            )?
            .build()?
    };

    let final_plan = LogicalPlanBuilder::from(all_prints_plan)
        .join(
            matched_prints_plan,
            JoinType::Inner,
            (vec!["cards.oracle_id"], vec!["matched_oracle_id"]),
            None,
        )?
        .project(
            oracle_group_cols()
                .into_iter()
                .chain([col("all_prints"), col("matched_prints")])
                .collect::<Vec<_>>(),
        )?
        .build()?;

    Ok(final_plan)
}

fn prints_as_struct(prints_schema: &DFSchema) -> Expr {
    // Build pairs of ("field_name", col("prints.field_name")) for every prints column
    let args: Vec<Expr> = prints_schema
        .fields()
        .iter()
        .flat_map(|f| {
            let name = f.name();
            [
                Expr::Literal(
                    ScalarValue::Utf8(Some(name.clone())),
                    Some(FieldMetadata::from(f.metadata())),
                ),
                col(format!("prints.{}", name)),
            ]
        })
        .collect();

    named_struct(args)
}

fn split_expr(
    expr: &ScryfallExpr,
) -> Result<(Option<ScryfallExpr>, Option<ScryfallExpr>), PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            let is_print = PredicateField::try_from(p.field.as_str())
                .map(|f| matches!(f,
                    PredicateField::Artist
                    | PredicateField::FlavorText
                    | PredicateField::Watermark
                    | PredicateField::Border
                    | PredicateField::Frame
                    | PredicateField::Stamp
                    | PredicateField::CollectorNumber
                    | PredicateField::Rarity
                    | PredicateField::Lang
                    | PredicateField::ScryfallId
                    | PredicateField::Year
                    | PredicateField::Game
                    | PredicateField::Set
                    | PredicateField::In
                    | PredicateField::SetType
                ))
                .unwrap_or(false)
                // is: needs value inspection since some flags are oracle, some print
                || (p.field == "is" && is_print_is_flag(&p.value));

            if is_print {
                Ok((None, Some(expr.clone())))
            } else {
                Ok((Some(expr.clone()), None))
            }
        }

        ScryfallExpr::And(l, r) => {
            let (lo, lp) = split_expr(l)?;
            let (ro, rp) = split_expr(r)?;
            Ok((combine_and(lo, ro), combine_and(lp, rp)))
        }

        // OR crossing scopes: conservatively treat as print-side so the
        // full filter runs in subquery B. The oracle filter in subquery A
        // will just be absent for this subtree, meaning more cards come
        // through A — but B will still filter them correctly.
        ScryfallExpr::Or(l, r) => {
            let either_print = references_print_fields_expr(r)? || references_print_fields_expr(l)?;
            if either_print {
                Ok((None, Some(expr.clone())))
            } else {
                Ok((Some(expr.clone()), None))
            }
        }

        ScryfallExpr::Not(inner) => {
            let (o, p) = split_expr(inner)?;
            Ok((
                o.map(|e| ScryfallExpr::Not(Box::new(e))),
                p.map(|e| ScryfallExpr::Not(Box::new(e))),
            ))
        }

        ScryfallExpr::True => Ok((Some(ScryfallExpr::True), None)),
    }
}

fn combine_and(a: Option<ScryfallExpr>, b: Option<ScryfallExpr>) -> Option<ScryfallExpr> {
    match (a, b) {
        (Some(a), Some(b)) => Some(ScryfallExpr::And(Box::new(a), Box::new(b))),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

fn is_print_is_flag(value: &str) -> bool {
    matches!(
        value.to_lowercase().as_str(),
        "reprint"
            | "firstprinting"
            | "booster"
            | "promo"
            | "digital"
            | "oversized"
            | "story_spotlight"
            | "textless"
            | "full_art"
            | "foil"
            | "nonfoil"
            | "etched"
    )
}

fn references_print_fields_expr(expr: &ScryfallExpr) -> Result<bool, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => Ok(PredicateField::try_from(p.field.as_str())?
            .is_print_field()
            || (p.field == "is" && is_print_is_flag(&p.value))),
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            Ok(references_print_fields_expr(l)? || references_print_fields_expr(r)?)
        }
        ScryfallExpr::Not(inner) => references_print_fields_expr(inner),
        ScryfallExpr::True => Ok(false),
    }
}

fn expr_to_df_expr(expr: &ScryfallExpr, schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(pred) => predicate_to_df_expr(pred, schema),
        ScryfallExpr::And(l, r) => Ok(expr_to_df_expr(l, schema)?.and(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Or(l, r) => Ok(expr_to_df_expr(l, schema)?.or(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Not(inner) => Ok(not(expr_to_df_expr(inner, schema)?)),
        ScryfallExpr::True => Ok(lit(true)),
    }
}

fn predicate_to_df_expr(pred: &Predicate, _schema: &DFSchema) -> Result<DFExpr, PlanError> {
    let field = PredicateField::try_from(pred.field.as_str())?;

    match field {
        // Oracle-side (cards.*)
        PredicateField::Name => text_pred("cards.name", &pred.op, &pred.value),
        PredicateField::Type => text_pred("cards.type_line", &pred.op, &pred.value),
        PredicateField::Oracle => text_pred("cards.oracle_text", &pred.op, &pred.value),
        PredicateField::Mana => text_pred("cards.mana_cost", &pred.op, &pred.value),
        PredicateField::Power => flexible_numeric_pred("cards.power", &pred.op, &pred.value),
        PredicateField::Toughness => {
            flexible_numeric_pred("cards.toughness", &pred.op, &pred.value)
        }
        PredicateField::Loyalty => flexible_numeric_pred("cards.loyalty", &pred.op, &pred.value),
        PredicateField::Defense => flexible_numeric_pred("cards.defense", &pred.op, &pred.value),
        PredicateField::Edhrec => numeric_pred("cards.edhrec_rank", &pred.op, &pred.value),
        PredicateField::Penny => numeric_pred("cards.penny_rank", &pred.op, &pred.value),
        PredicateField::PowTou => powtou_pred(&pred.op, &pred.value),
        PredicateField::Color => color_pred("cards.colors", &pred.op, &pred.value),
        PredicateField::Identity => color_pred("cards.color_identity", &pred.op, &pred.value),
        PredicateField::Cmc => numeric_pred("cards.cmc", &pred.op, &pred.value),
        PredicateField::Layout => text_pred("cards.layout", &pred.op, &pred.value),
        PredicateField::OracleId => exact_pred("cards.oracle_id", &pred.value),
        PredicateField::Produces => Ok(array_contains_expr(
            "cards.produced_mana",
            lit(pred.value.to_uppercase()),
        )),
        PredicateField::OracleTag => Ok(array_contains_expr(
            "cards.otags",
            lit(pred.value.to_lowercase()),
        )),
        PredicateField::Keyword => Ok(array_contains_expr(
            "cards.keywords",
            lit(pred.value.to_lowercase()),
        )),
        PredicateField::Format => format_pred(&pred.value),

        // Print-side (prints.*)
        PredicateField::Artist => text_pred("prints.artist", &pred.op, &pred.value),
        PredicateField::FlavorText => text_pred("prints.flavor_text", &pred.op, &pred.value),
        PredicateField::Watermark => text_pred("prints.watermark", &pred.op, &pred.value),
        PredicateField::Border => text_pred("prints.border_color", &pred.op, &pred.value),
        PredicateField::Frame => text_pred("prints.frame", &pred.op, &pred.value),
        PredicateField::Stamp => text_pred("prints.security_stamp", &pred.op, &pred.value),
        PredicateField::CollectorNumber => exact_pred("prints.collector_number", &pred.value),
        PredicateField::Rarity => exact_pred("prints.rarity", &pred.value),
        PredicateField::Lang => exact_pred("prints.lang", &pred.value),
        PredicateField::ScryfallId => exact_pred("prints.scryfall_id", &pred.value),
        PredicateField::Year => text_pred("prints.released_at", &pred.op, &pred.value),
        PredicateField::Game => Ok(array_contains_expr(
            "prints.games",
            lit(pred.value.to_lowercase()),
        )),

        PredicateField::Set => {
            if pred.value.len() <= 4 && pred.value.chars().all(|c| c.is_alphanumeric()) {
                Ok(col("prints.set_code").eq(lit(pred.value.to_lowercase())))
            } else {
                text_pred("sets.name", &pred.op, &pred.value)
            }
        }

        PredicateField::In => {
            let val = pred.value.to_lowercase();
            if matches!(
                val.as_str(),
                "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus"
            ) {
                exact_pred("prints.rarity", &pred.value)
            } else if matches!(val.as_str(), "paper" | "arena" | "mtgo") {
                Ok(array_contains_expr("prints.games", lit(val)))
            } else {
                exact_pred("prints.set_code", &pred.value)
            }
        }

        // Set-table (sets.*)
        PredicateField::SetType => exact_pred("sets.set_type", &pred.value),

        // Mixed / special
        PredicateField::Is => is_pred(&pred.value),
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

fn flexible_numeric_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
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

fn powtou_pred(op: &Op, value: &str) -> Result<DFExpr, PlanError> {
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

fn cast_expr(expr: DFExpr, data_type: arrow_schema::DataType) -> DFExpr {
    DFExpr::Cast(datafusion::logical_expr::Cast {
        expr: Box::new(expr),
        data_type,
    })
}

fn color_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    let letters = normalize_colors(value);

    match op {
        Op::Colon => {
            if letters == "C" {
                return Ok(array_length_expr(column).eq(lit(0)));
            }
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

fn format_pred(value: &str) -> Result<DFExpr, PlanError> {
    let format = value.to_lowercase();
    Ok(col("cards.legalities")
        .field(&format)
        .not_eq(lit("not_legal"))
        .and(col("cards.legalities").field(format).not_eq(lit("banned"))))
}

fn is_pred(value: &str) -> Result<DFExpr, PlanError> {
    match value.to_lowercase().as_str() {
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
        "commander" => Ok((array_contains_expr("cards.super_types", lit("Legendary"))
            .and(array_contains_expr("cards.card_types", lit("Creature"))))
        .or(array_contains_expr(
            "cards.otags",
            lit("can_be_your_commander"),
        ))),

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

fn references_set_table(expr: &ScryfallExpr) -> bool {
    match expr {
        ScryfallExpr::Predicate(p) => PredicateField::try_from(p.field.as_str())
            .map(|f| f.needs_set_table(&p.value))
            .unwrap_or(false),
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            references_set_table(l) || references_set_table(r)
        }
        ScryfallExpr::Not(inner) => references_set_table(inner),
        ScryfallExpr::True => false,
    }
}

fn regexp_like_expr(column: &str, pattern: &str) -> DFExpr {
    let udf: Arc<ScalarUDF> = datafusion::functions::regex::regexp_like();
    udf.call(vec![col(column), lit(pattern), lit("i")])
}

fn array_contains_expr(column: &str, element: DFExpr) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_has(col(column), element)
}

fn array_length_expr(column: &str) -> DFExpr {
    datafusion_functions_nested::expr_fn::array_length(col(column))
}

fn lit_array(vec: Vec<String>) -> DFExpr {
    let values: Vec<ScalarValue> = vec.into_iter().map(ScalarValue::from).collect();
    let array = ScalarValue::new_list(&values, &arrow_schema::DataType::Utf8, true);
    lit(ScalarValue::List(array))
}

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
    colors.chars().filter(|c| "WUBRGCM".contains(*c)).collect()
}

fn canonical_color_vec(letters: &str) -> Vec<String> {
    const ORDER: &str = "WUBRG";
    let mut out: Vec<char> = letters.chars().filter(|c| ORDER.contains(*c)).collect();
    out.sort_by_key(|c| ORDER.find(*c).unwrap_or(usize::MAX));
    out.dedup();
    out.into_iter().map(|c| c.to_string()).collect()
}

// ---------------------------------------------------------------------------
// GROUP BY columns — every column on the cards table
// Must stay in sync with the Card struct
// ---------------------------------------------------------------------------

fn oracle_group_cols() -> Vec<DFExpr> {
    [
        "oracle_id",
        "name",
        "layout",
        "cmc",
        "color_identity",
        "color_indicator",
        "colors",
        "game_changer",
        "reserved",
        "otags",
        "edhrec_rank",
        "penny_rank",
        "power",
        "toughness",
        "loyalty",
        "defense",
        "keywords",
        "legalities",
        "mana_cost",
        "oracle_text",
        "produced_mana",
        "type_line",
        "card_types",
        "super_types",
        "sub_types",
        "all_parts",
        "preview",
        "card_faces",
    ]
    .iter()
    .map(|name| col(format!("cards.{name}")))
    .collect()
}
