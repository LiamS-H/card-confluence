use datafusion::common::DFSchema;
use datafusion::logical_expr::{Expr as DFExpr, lit, not};

use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::predicates::PredicateField;
use crate::query_parser::planner::PlanError;

pub fn needs_prints_table(expr: &ScryfallExpr) -> Result<bool, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            Ok(PredicateField::try_from(p.field.as_str())?.needs_print_table(&p.value))
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            Ok(needs_prints_table(l)? || needs_prints_table(r)?)
        }
        ScryfallExpr::Not(inner) => needs_prints_table(inner),
        ScryfallExpr::True => Ok(false),
    }
}

pub fn needs_sets_table(expr: &ScryfallExpr) -> Result<bool, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            PredicateField::try_from(p.field.as_str()).map(|f| f.needs_set_table(&p.value))
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            Ok(needs_sets_table(l)? || needs_sets_table(r)?)
        }
        ScryfallExpr::Not(inner) => needs_sets_table(inner),
        ScryfallExpr::True => Ok(false),
    }
}

pub fn expr_to_df_expr(expr: &ScryfallExpr, schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(pred) => pred.to_df_expr(),
        ScryfallExpr::And(l, r) => Ok(expr_to_df_expr(l, schema)?.and(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Or(l, r) => Ok(expr_to_df_expr(l, schema)?.or(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Not(inner) => Ok(not(expr_to_df_expr(inner, schema)?)),
        ScryfallExpr::True => Ok(lit(true)),
    }
}
