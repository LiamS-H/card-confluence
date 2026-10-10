use std::sync::Arc;

use datafusion::{
    functions::regex::regexp_like,
    logical_expr::{Expr as DFExpr, ScalarUDF, col, lit},
};
use datafusion_functions_nested::expr_fn::array_has;

/// Case-insensitive `regexp_like` on an arbitrary expression (not just a column).
pub fn regexp_like_expr(expr: DFExpr, pattern: &str) -> DFExpr {
    let udf: Arc<ScalarUDF> = regexp_like();
    udf.call(vec![expr, lit(pattern), lit("i")])
}
pub fn array_contains_expr(column: &str, element: DFExpr) -> DFExpr {
    array_has(col(column), element)
}

/// AND every expression in `exprs` onto `base`.
pub fn and_all(base: DFExpr, exprs: impl IntoIterator<Item = DFExpr>) -> DFExpr {
    exprs.into_iter().fold(base, |acc, e| acc.and(e))
}

/// `column` contains at least one of `values` (OR-ed `array_has` checks).
pub fn array_has_any(column: &str, values: &[&str]) -> DFExpr {
    values
        .iter()
        .map(|v| array_contains_expr(column, lit(*v)))
        .reduce(|a, b| a.or(b))
        .unwrap_or_else(|| lit(false))
}
