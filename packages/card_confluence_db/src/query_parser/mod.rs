pub mod lexer;
pub mod parser;
pub mod planner;

use datafusion::logical_expr::LogicalPlan;
use datafusion::prelude::SessionContext;

/// Top-level error type, wrapping the three internal stages.
#[derive(Debug)]
pub enum ScryfallError {
    Lex(lexer::LexError),
    Parse(parser::ParseError),
    Plan(planner::PlanError),
}

impl std::fmt::Display for ScryfallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScryfallError::Lex(e) => write!(f, "{e}"),
            ScryfallError::Parse(e) => write!(f, "{e}"),
            ScryfallError::Plan(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for ScryfallError {}

impl From<lexer::LexError> for ScryfallError {
    fn from(e: lexer::LexError) -> Self {
        ScryfallError::Lex(e)
    }
}

impl From<parser::ParseError> for ScryfallError {
    fn from(e: parser::ParseError) -> Self {
        ScryfallError::Parse(e)
    }
}

impl From<planner::PlanError> for ScryfallError {
    fn from(e: planner::PlanError) -> Self {
        ScryfallError::Plan(e)
    }
}

pub async fn parse_query(ctx: &SessionContext, input: &str) -> Result<LogicalPlan, ScryfallError> {
    // Stage 1 – Lex
    let tokens = lexer::tokenize(input)?;

    // Stage 2 – Parse
    let ast = parser::parse(tokens)?;

    // Stage 3 – Plan
    let plan = planner::build_plan(ctx, &ast).await?;

    Ok(plan)
}

pub fn parse_to_ast(input: &str) -> Result<parser::ScryfallExpr, ScryfallError> {
    let tokens = lexer::tokenize(input)?;
    let ast = parser::parse(tokens)?;
    Ok(ast)
}
