use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::predicates::Predicate;
use crate::query_parser::planner::{
    expr_to_df_expr, needs_prints_table, needs_sets_table, predicates::PredicateField, PlanError,
};
use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::logical_expr::{col, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder};
use datafusion::prelude::{JoinType, SessionContext};

pub async fn build_distinct_values_plan(
    ctx: &SessionContext,
    context_expr: &ScryfallExpr,
    pred: PredicateField,
) -> Result<LogicalPlan, PlanError> {
    let needs_set = matches!(pred, PredicateField::Set | PredicateField::SetType)
        || needs_sets_table(context_expr)?;

    let mut builder = LogicalPlanBuilder::from(ctx.table("cards").await?.into_unoptimized_plan());

    let needs_print = needs_set || pred.is_print_field() || needs_prints_table(context_expr)?;
    if needs_print {
        let prints_plan = ctx.table("prints").await?.into_unoptimized_plan();
        builder = builder.join(
            prints_plan,
            JoinType::Inner,
            (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
            None,
        )?;
    };

    if needs_set {
        let sets_plan = ctx.table("sets").await?.into_unoptimized_plan();
        builder = builder.join(
            sets_plan,
            JoinType::Inner,
            (vec!["prints.set_code"], vec!["sets.code"]),
            None,
        )?;
    };

    let schema = builder.schema().clone();
    builder = builder.filter(expr_to_df_expr(context_expr, &schema)?)?;
    let plan = builder.build()?;

    let expr = pred.to_unique_df_expr()?;
    let mut builder =
        LogicalPlanBuilder::from(plan).project(vec![expr.alias("__completion_col__")])?;

    if pred.is_array() {
        builder = builder.unnest_column("__completion_col__")?;

        if matches!(
            pred,
            PredicateField::Artist | PredicateField::FlavorText | PredicateField::Watermark
        ) {
            let field_name = match pred {
                PredicateField::Artist => "artist",
                PredicateField::FlavorText => "flavor_text",
                PredicateField::Watermark => "watermark",
                _ => unreachable!(),
            };
            builder = builder.project(vec![col("__completion_col__")
                .field(field_name)
                .alias("__completion_col__")])?;
        }
    }

    let distinct_plan = builder
        .distinct()?
        .sort(vec![col("__completion_col__").sort(true, true)])?
        .build()?;

    Ok(distinct_plan)
}

pub fn replace_predicate_with_true(expr: &ScryfallExpr, target: &Predicate) -> ScryfallExpr {
    match expr {
        ScryfallExpr::Predicate(pred) => {
            if pred == target {
                ScryfallExpr::True
            } else {
                expr.clone()
            }
        }
        ScryfallExpr::And(l, r) => ScryfallExpr::And(
            Box::new(replace_predicate_with_true(l, target)),
            Box::new(replace_predicate_with_true(r, target)),
        ),
        ScryfallExpr::Or(l, r) => ScryfallExpr::Or(
            Box::new(replace_predicate_with_true(l, target)),
            Box::new(replace_predicate_with_true(r, target)),
        ),
        ScryfallExpr::Not(inner) => {
            ScryfallExpr::Not(Box::new(replace_predicate_with_true(inner, target)))
        }
        ScryfallExpr::True => ScryfallExpr::True,
    }
}

pub fn find_predicate<'a>(
    expr: &'a ScryfallExpr,
    pos: usize,
) -> Option<(&'a Predicate, Vec<&'a ScryfallExpr>)> {
    match expr {
        ScryfallExpr::Predicate(pred) => {
            if pos >= pred.start && pos <= pred.end {
                Some((pred, vec![expr]))
            } else {
                None
            }
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => find_predicate(l, pos)
            .or_else(|| find_predicate(r, pos))
            .map(|(p, mut path)| {
                path.push(expr);
                (p, path)
            }),
        ScryfallExpr::Not(inner) => find_predicate(inner, pos).map(|(p, mut path)| {
            path.push(expr);
            (p, path)
        }),
        ScryfallExpr::True => None,
    }
}

impl PredicateField {
    pub fn is_array(&self) -> bool {
        matches!(
            self,
            PredicateField::Type
                | PredicateField::Color
                | PredicateField::Identity
                | PredicateField::Produces
                | PredicateField::OracleTag
                | PredicateField::Keyword
                | PredicateField::Artist
                | PredicateField::FlavorText
                | PredicateField::Watermark
                | PredicateField::Game
        )
    }

    pub fn to_unique_df_expr(&self) -> Result<DFExpr, PlanError> {
        match self {
            PredicateField::Type => Ok(datafusion_functions_nested::expr_fn::array_concat(vec![
                col("cards.super_types"),
                col("cards.card_types"),
                col("cards.sub_types"),
            ])),
            PredicateField::Artist | PredicateField::FlavorText | PredicateField::Watermark => {
                Ok(col("prints.illustrations"))
            }
            PredicateField::Set => Ok(col("prints.set_code")),
            PredicateField::SetType => Ok(col("sets.set_type")),
            _ => {
                if let Some(col_name) = self.full_column() {
                    Ok(col(col_name))
                } else if let Some(col_name) = self.column_name() {
                    Ok(col(col_name))
                } else {
                    Err(PlanError(format!(
                        "Autocomplete not supported for field {:?}",
                        self
                    )))
                }
            }
        }
    }
}
