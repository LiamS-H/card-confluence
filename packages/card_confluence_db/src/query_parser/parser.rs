use crate::query_parser::{
    lexer::{Op, Token, TokenKind},
    planner::predicates::Predicate,
};

/// The AST node.
#[derive(Debug, Clone, PartialEq)]
pub enum ScryfallExpr {
    /// A leaf comparison such as `cmc>=3` or `c:blue`
    Predicate(Predicate),
    /// Logical AND of two sub-expressions
    And(Box<ScryfallExpr>, Box<ScryfallExpr>),
    /// Logical OR of two sub-expressions
    Or(Box<ScryfallExpr>, Box<ScryfallExpr>),
    /// Logical NOT of a sub-expression
    Not(Box<ScryfallExpr>),
    /// Matches everything (used for autocompletion context)
    True,
}

#[derive(Debug)]
pub struct ParseError(pub String);

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Parse error: {}", self.0)
    }
}

impl std::error::Error for ParseError {}
struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<&Token> {
        let tok = self.tokens.get(self.pos);
        self.pos += 1;
        tok
    }

    fn expect_value(&mut self) -> Result<(String, usize, usize), ParseError> {
        match self.advance() {
            Some(t) => match &t.kind {
                TokenKind::Value(v) => Ok((v.clone(), t.start, t.end)),
                other => Err(ParseError(format!("Expected value, got {other:?}"))),
            },
            None => Err(ParseError("Expected value, got end of input".into())),
        }
    }

    // -----------------------------------------------------------------------
    // Recursive descent
    // -----------------------------------------------------------------------

    fn parse_expr(&mut self) -> Result<ScryfallExpr, ParseError> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<ScryfallExpr, ParseError> {
        let mut left = self.parse_and()?;

        while matches!(self.peek(), Some(t) if matches!(t.kind, TokenKind::Or)) {
            self.advance(); // consume OR
            let right = self.parse_and()?;
            left = ScryfallExpr::Or(Box::new(left), Box::new(right));
        }

        Ok(left)
    }

    fn parse_and(&mut self) -> Result<ScryfallExpr, ParseError> {
        let mut expr = self.parse_not()?;

        loop {
            let implicit_and = matches!(
                self.peek(),
                Some(Token {
                    kind: TokenKind::Ident(_)
                        | TokenKind::Value(_)
                        | TokenKind::Not
                        | TokenKind::LParen,
                    ..
                })
            );

            let explicit_and = matches!(
                self.peek(),
                Some(Token {
                    kind: TokenKind::And,
                    ..
                })
            );

            if explicit_and {
                self.advance();
            } else if !implicit_and {
                break;
            }

            let rhs = self.parse_not()?;
            expr = ScryfallExpr::And(Box::new(expr), Box::new(rhs));
        }

        Ok(expr)
    }

    fn parse_not(&mut self) -> Result<ScryfallExpr, ParseError> {
        if matches!(self.peek(), Some(t) if matches!(t.kind, TokenKind::Not)) {
            self.advance(); // consume NOT / `-`
            let inner = self.parse_not()?; // right-associative
            return Ok(ScryfallExpr::Not(Box::new(inner)));
        }
        self.parse_atom()
    }

    fn parse_atom(&mut self) -> Result<ScryfallExpr, ParseError> {
        match self.peek() {
            Some(t) if matches!(t.kind, TokenKind::LParen) => {
                self.advance(); // consume `(`
                let inner = self.parse_expr()?;
                match self.advance() {
                    Some(t) if matches!(t.kind, TokenKind::RParen) => Ok(inner),
                    Some(other) => Err(ParseError(format!("Expected closing ')', got {other:?}"))),
                    None => Err(ParseError("Expected closing ')', got end of input".into())),
                }
            }

            // field OP value
            Some(t) if matches!(t.kind, TokenKind::Ident(_)) => {
                let (field, start) = match self.advance() {
                    Some(t) => match &t.kind {
                        TokenKind::Ident(f) => (f.to_lowercase(), t.start),
                        _ => unreachable!(),
                    },
                    _ => unreachable!(),
                };

                let op = match self.advance() {
                    Some(t) => match &t.kind {
                        TokenKind::Op(o) => o.clone(),
                        other => {
                            return Err(ParseError(format!(
                                "Expected operator after field '{field}', got {other:?}"
                            )))
                        }
                    },
                    None => {
                        return Err(ParseError(format!(
                            "Expected operator after field '{field}', got end of input"
                        )))
                    }
                };

                let (mut value, _, end) = self.expect_value()?;
                if !(value.starts_with('/') && value.ends_with('/') && value.len() >= 2) {
                    value = value.to_lowercase();
                }

                Ok(ScryfallExpr::Predicate(Predicate {
                    field,
                    op,
                    value,
                    start,
                    end,
                }))
            }

            // Bare word — treat as `name:<value>` (case-insensitive name contains)
            Some(t) if matches!(t.kind, TokenKind::Value(_)) => {
                let (value, start, end) = match self.advance() {
                    Some(t) => match &t.kind {
                        TokenKind::Value(v) => (v.to_lowercase(), t.start, t.end),
                        _ => unreachable!(),
                    },
                    _ => unreachable!(),
                };
                Ok(ScryfallExpr::Predicate(Predicate {
                    field: "name".into(),
                    op: Op::Colon,
                    value,
                    start,
                    end,
                }))
            }

            Some(other) => Err(ParseError(format!(
                "Unexpected token at start of expression: {other:?}"
            ))),
            None => Err(ParseError("Unexpected end of input".into())),
        }
    }
}

pub fn parse(tokens: Vec<Token>) -> Result<ScryfallExpr, ParseError> {
    let mut parser = Parser::new(tokens);
    let expr = parser.parse_expr()?;
    if parser.pos < parser.tokens.len() {
        Err(ParseError(format!(
            "Unexpected token after expression end: {:?}",
            parser.tokens[parser.pos]
        )))
    } else {
        Ok(expr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query_parser::lexer::tokenize;

    fn p(input: &str) -> ScryfallExpr {
        let tokens = tokenize(input).expect("lex");
        parse(tokens).expect("parse")
    }

    #[test]
    fn test_case_insensitivity() {
        assert_eq!(
            p("C:Blue"),
            ScryfallExpr::Predicate(Predicate {
                field: "c".into(),
                op: Op::Colon,
                value: "blue".into(),
                start: 0,
                end: 6,
            })
        );
    }

    #[test]
    fn test_regex_preserves_case() {
        assert_eq!(
            p("n:/Lightning/"),
            ScryfallExpr::Predicate(Predicate {
                field: "n".into(),
                op: Op::Colon,
                value: "/Lightning/".into(),
                start: 0,
                end: 13,
            })
        );
    }

    #[test]
    fn test_single_predicate() {
        assert_eq!(
            p("c:blue"),
            ScryfallExpr::Predicate(Predicate {
                field: "c".into(),
                op: Op::Colon,
                value: "blue".into(),
                start: 0,
                end: 6,
            })
        );
    }

    #[test]
    fn test_implicit_and() {
        let expr = p("c:blue cmc>=3");
        assert!(matches!(expr, ScryfallExpr::And(_, _)));
    }

    #[test]
    fn test_explicit_or() {
        let expr = p("t:creature OR t:instant");
        assert!(matches!(expr, ScryfallExpr::Or(_, _)));
    }

    #[test]
    fn test_not() {
        let expr = p("-t:land");
        assert!(matches!(expr, ScryfallExpr::Not(_)));
    }
    #[test]
    fn test_bare_parentheses() {
        let expr = p("(t:creature) c:blue");
        let ScryfallExpr::And(arg1, arg2) = expr else {
            panic!()
        };
        assert!(matches!(*arg1, ScryfallExpr::Predicate(_)));
        assert!(matches!(*arg2, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_parentheses() {
        let expr = p("(t:creature OR t:instant) c:blue");
        let ScryfallExpr::And(arg1, arg2) = expr else {
            panic!()
        };
        assert!(matches!(*arg1, ScryfallExpr::Or(_, _)));
        assert!(matches!(*arg2, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_nested_parentheses() {
        let expr = p("is:test OR ((t:creature OR t:instant) c:blue)");
        let ScryfallExpr::Or(arg1, arg2) = expr else {
            panic!()
        };
        assert!(matches!(*arg1, ScryfallExpr::Predicate(_)));
        let ScryfallExpr::And(arg2_1, arg2_2) = *arg2 else {
            panic!()
        };
        assert!(matches!(*arg2_1, ScryfallExpr::Or(_, _)));
        assert!(matches!(*arg2_2, ScryfallExpr::Predicate(_)));
    }
    #[test]
    fn test_touching_parentheses() {
        let expr = p("(t:creature OR t:instant)c:blue");
        let ScryfallExpr::And(arg1, arg2) = expr else {
            panic!()
        };
        assert!(matches!(*arg1, ScryfallExpr::Or(_, _)));
        assert!(matches!(*arg2, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_bare_word_becomes_name_predicate() {
        assert_eq!(
            p("lightning"),
            ScryfallExpr::Predicate(Predicate {
                field: "name".into(),
                op: Op::Colon,
                value: "lightning".into(),
                start: 0,
                end: 9,
            })
        );
    }
}
