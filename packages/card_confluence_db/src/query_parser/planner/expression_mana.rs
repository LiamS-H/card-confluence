use std::collections::BTreeMap;

use arrow::datatypes::DataType;
use datafusion::functions::expr_fn::{regexp_replace, replace};
use datafusion::functions::unicode::expr_fn::character_length;
use datafusion::logical_expr::{Expr as DFExpr, col, lit, not};

use crate::query_parser::lexer::Op;
use crate::query_parser::planner::PlanError;
use crate::query_parser::planner::expression_pred::{cast_expr, ord_pred};
use crate::query_parser::planner::expression_utils::{and_all, regexp_like_expr};
const ALL_MANA_SYMBOLS: &str = "WUBRGCXYS";

/// A parsed mana query like "{2}{u}{u/p}" or "2uu".
#[derive(Default)]
struct ManaCost {
    generic: i64,
    /// Simple colored pips: W, U, B, R, G, C
    colored: BTreeMap<char, i64>,
    /// Hybrid / phyrexian pips matched as exact symbols, e.g. "U/P", "2/W", "U/W"
    complex: BTreeMap<String, i64>,
}

impl ManaCost {
    fn mana_value(&self) -> i64 {
        self.generic
            + self.colored.values().sum::<i64>()
            + self
                .complex
                .iter()
                .map(|(s, n)| complex_symbol_value(s) * n)
                .sum::<i64>()
    }

    /// Adds one pip: a number, a simple color, or a complex symbol like "U/P".
    /// Anything else (X, S, stray characters) is ignored.
    fn add_symbol(&mut self, symbol: &str) -> Result<(), PlanError> {
        let symbol = symbol.to_uppercase();
        if let Ok(n) = symbol.parse::<i64>() {
            self.generic += n;
        } else if symbol.contains('/') {
            let mut parts: Vec<&str> = symbol.split('/').collect();
            if parts
                .iter()
                .any(|p| p.is_empty() || !p.chars().all(|c| c.is_ascii_alphanumeric()))
            {
                return Err(PlanError(format!("Invalid mana symbol '{{{symbol}}}'")));
            }
            // {u/w} and {w/u} are the same symbol
            if parts.len() == 2 {
                parts.sort();
            }
            *self.complex.entry(parts.join("/")).or_insert(0) += 1;
        } else if let Some(c) = symbol.chars().find(|c| "WUBRGC".contains(*c)) {
            *self.colored.entry(c).or_insert(0) += 1;
        }
        Ok(())
    }
}

/// Mana value a complex symbol contributes: {2/W} is 2, hybrid and phyrexian pips are 1.
fn complex_symbol_value(symbol: &str) -> i64 {
    symbol
        .split('/')
        .filter_map(|p| p.parse::<i64>().ok())
        .max()
        .unwrap_or(1)
}

/// Parses mana queries. "{2}{u}{u}", "2uu" and "{u}{u}2" all produce the same cost, and the
/// two styles can be mixed ("2{u/p}u"). Hybrid/phyrexian symbols must be braced.
/// values can be flipped well {u/w} == {w/u} and {u/p} == {p/u}
fn parse_mana(value: &str) -> Result<ManaCost, PlanError> {
    let mut cost = ManaCost::default();
    let mut chars = value.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '{' => {
                // take_while also consumes the closing '}'
                let symbol: String = chars.by_ref().take_while(|&c| c != '}').collect();
                cost.add_symbol(&symbol)?;
            }
            d if d.is_ascii_digit() => {
                let mut num = d.to_string();
                while let Some(n) = chars.next_if(|c| c.is_ascii_digit()) {
                    num.push(n);
                }
                cost.add_symbol(&num)?;
            }
            '/' => {
                return Err(PlanError(
                    "Hybrid/phyrexian symbols must be written in braces, e.g. {u/p}".into(),
                ));
            }
            other => cost.add_symbol(&other.to_string())?,
        }
    }

    Ok(cost)
}

/// Regex body for one complex symbol; two-part hybrids match in either order ("W/U" or "U/W").
fn symbol_regex(symbol: &str) -> String {
    match symbol.split('/').collect::<Vec<_>>().as_slice() {
        [a, b] if a != b => format!("(?:{a}/{b}|{b}/{a})"),
        _ => symbol.to_string(),
    }
}

/// Regex body for a simple color pip. Strict: only the plain pip, `{U}`.
/// Loose: any pip containing the color, so `{U/P}` and `{W/U}` count too.
fn color_body(color: char, strict: bool) -> String {
    if strict {
        color.to_string()
    } else {
        format!("[^}}]*{color}[^}}]*")
    }
}

/// The cost has at least `count` pips whose text matches `body`.
fn pip_count(expr: DFExpr, body: &str, count: i64) -> DFExpr {
    regexp_like_expr(expr, &format!("(?i)(?:.*?\\{{{body}\\}}){{{count}}}"))
}

/// Removes every pip whose text matches `body` from the cost string.
fn remove_pips(expr: DFExpr, body: &str) -> DFExpr {
    regexp_replace(
        expr,
        lit(format!("\\{{(?:{body})\\}}")),
        lit(""),
        Some(lit("gi")),
    )
}

/// Card's generic mana: cmc minus the number of colored/phyrexian blocks in the cost.
fn card_generic_expr(column: &str) -> DFExpr {
    let replaced = regexp_replace(
        col(column),
        lit(r"\{[^}]*[WUBRGP][^}]*\}"),
        lit("@"),
        Some(lit("gi")),
    );
    let blocks =
        character_length(replaced.clone()) - character_length(replace(replaced, lit("@"), lit("")));
    cast_expr(col("cards.cmc"), DataType::Int64) - cast_expr(blocks, DataType::Int64)
}

/// `=` / `!=` are strict: `={u}` matches only plain {U} pips, never {U/W}.
/// `:` and the ordering operators are loose: a hybrid pip counts toward each of its colors,
/// so `:{u}` and `>={u}` also find {U/W} and {U/P}.
/// Complex symbols in the query ({u/p}, {2/w}) are always matched as exact symbols.
pub fn mana_pred(column: &str, op: &Op, value: &str) -> Result<DFExpr, PlanError> {
    // `:` means "contains at least this cost"
    let op = if *op == Op::Colon { &Op::Gte } else { op };

    let cost = parse_mana(value)?;
    let generic = cost.generic;
    let req_cmc_lit = lit(cost.mana_value() as f64);
    let generic_expr = (generic > 0).then(|| card_generic_expr(column));
    let strict = matches!(op, Op::Eq | Op::Ne);

    // Simple pips are checked against the cost with the requested complex symbols set aside,
    // so `{u/p}` doesn't also satisfy `{u}`.
    let simple = if cost.complex.is_empty() {
        col(column)
    } else {
        let alts: Vec<String> = cost.complex.keys().map(|s| symbol_regex(s)).collect();
        remove_pips(col(column), &alts.join("|"))
    };

    // What the "no other colors" checks look at. When loose, a hybrid pip containing a
    // requested color is allowed ({u/w} is fine for `:{u}`), so those pips are set aside too.
    let others = if strict || cost.colored.is_empty() {
        simple.clone()
    } else {
        let requested: String = cost.colored.keys().collect();
        remove_pips(simple.clone(), &format!("[^}}]*[{requested}][^}}]*"))
    };

    let simple_at_least: Vec<DFExpr> = cost
        .colored
        .iter()
        .map(|(c, n)| pip_count(simple.clone(), &color_body(*c, strict), *n))
        .collect();
    let complex_at_least: Vec<DFExpr> = cost
        .complex
        .iter()
        .map(|(s, n)| pip_count(col(column), &symbol_regex(s), *n))
        .collect();
    let complex_at_most: Vec<DFExpr> = cost
        .complex
        .iter()
        .map(|(s, n)| not(pip_count(col(column), &symbol_regex(s), n + 1)))
        .collect();

    // Adds the card-generic-mana comparison (if the query asked for generic mana).
    let and_generic = |expr: DFExpr, op: &Op| match &generic_expr {
        Some(ge) => expr.and(ord_pred(ge.clone(), op, lit(generic))),
        None => expr,
    };

    // Exactly this cost: same cmc, same generic, same pips, nothing else.
    let exact = || {
        let expr = and_generic(col("cards.cmc").eq(req_cmc_lit.clone()), &Op::Eq);
        let expr = and_all(expr, simple_at_least.iter().cloned());
        let expr = and_all(expr, complex_at_least.iter().cloned());
        let expr = and_all(expr, complex_at_most.iter().cloned());
        and_all(
            expr,
            ALL_MANA_SYMBOLS
                .chars()
                .filter(|c| !cost.colored.contains_key(c))
                .map(|c| not(pip_count(others.clone(), &color_body(c, false), 1))),
        )
    };

    Ok(match op {
        Op::Colon => unreachable!(),
        Op::Eq => exact(),
        Op::Ne => not(exact()),
        Op::Gt | Op::Gte => {
            let expr = and_all(lit(true), simple_at_least.iter().cloned());
            let expr = and_all(expr, complex_at_least.iter().cloned());
            let expr = and_generic(expr, &Op::Gte);
            if *op == Op::Gt {
                expr.and(not(exact()))
            } else {
                expr
            }
        }
        Op::Lt | Op::Lte => {
            let expr = and_generic(ord_pred(col("cards.cmc"), op, req_cmc_lit), &Op::Lte);
            let expr = and_all(
                expr,
                ALL_MANA_SYMBOLS
                    .chars()
                    .map(|c| match cost.colored.get(&c) {
                        Some(n) => not(pip_count(simple.clone(), &color_body(c, false), n + 1)),
                        None => not(pip_count(others.clone(), &color_body(c, false), 1)),
                    }),
            );
            and_all(expr, complex_at_most)
        }
    })
}
