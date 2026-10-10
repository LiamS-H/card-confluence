use arrow::datatypes::DataType;
use datafusion::functions::expr_fn::lower;
use datafusion::logical_expr::{Expr as DFExpr, col, lit};
use datafusion::scalar::ScalarValue;
use datafusion_functions_nested::length::array_length;
use uuid::Uuid;

use crate::query_parser::planner::PlanError;
use crate::query_parser::planner::expressions_pred::cast_expr;

pub fn exact_lower_text(column: &str, value: &str) -> DFExpr {
    lower(col(column)).eq(lit(value.to_string()))
}

pub fn uuid_lit(value: &str) -> Result<DFExpr, PlanError> {
    let uuid = Uuid::parse_str(value).map_err(|e| PlanError(e.to_string()))?;

    Ok(lit(ScalarValue::FixedSizeBinary(16, Some(uuid.into()))))
}

pub fn array_length_expr(column: &str) -> DFExpr {
    array_length(col(column))
}

pub fn lit_array(vec: Vec<String>) -> DFExpr {
    let values: Vec<ScalarValue> = vec.into_iter().map(ScalarValue::from).collect();
    let array = ScalarValue::new_list(&values, &DataType::Utf8, true);
    lit(ScalarValue::List(array))
}
pub fn numeric_lit(value: &str) -> Result<DFExpr, PlanError> {
    let n: f64 = value
        .parse()
        .map_err(|_| PlanError(format!("Cannot parse '{value}' as a number")))?;
    Ok(lit(n))
}
/// `try_cast(col(column) as Float64)`; power/toughness/loyalty/defense are stored as strings.
pub fn float_col(column: &str) -> DFExpr {
    cast_expr(col(column), DataType::Float64)
}
