#[derive(Debug, Clone, PartialEq)]
pub enum Op {
    Colon,
    Eq,
    Ne,
    Lt,
    Lte,
    Gt,
    Gte,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    /// A bare keyword or field name, e.g. `cmc`, `name`, `t`
    Ident(String),
    /// A comparison operator
    Op(Op),
    /// A quoted or unquoted value, e.g. `blue`, `"Serra Angel"`
    Value(String),
    /// `AND` (also the implicit operator between adjacent terms)
    And,
    /// `OR`
    Or,
    /// `NOT` / `-` prefix
    Not,
    /// `(`
    LParen,
    /// `)`
    RParen,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug)]
pub struct LexError(pub String);

impl std::fmt::Display for LexError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Lex error: {}", self.0)
    }
}

impl std::error::Error for LexError {}

pub fn tokenize(input: &str) -> Result<Vec<Token>, LexError> {
    let chars: Vec<char> = input.chars().collect();
    let mut pos = 0;
    let mut tokens: Vec<Token> = Vec::new();

    while pos < chars.len() {
        let start = pos;
        let kind = match chars[pos] {
            ' ' | '\t' | '\n' | '\r' => {
                pos += 1;
                continue;
            }

            '(' => {
                pos += 1;
                TokenKind::LParen
            }
            ')' => {
                pos += 1;
                TokenKind::RParen
            }

            // `-` at word-boundary position is always a NOT prefix.
            // Mid-word `-` is consumed inside the alphanumeric arm below.
            '-' => {
                pos += 1;
                TokenKind::Not
            }

            '!' => {
                if chars.get(pos + 1) == Some(&'=') {
                    pos += 2;
                    TokenKind::Op(Op::Ne)
                } else {
                    return Err(LexError(format!("Unexpected '!' at position {pos}")));
                }
            }

            '<' => {
                if chars.get(pos + 1) == Some(&'=') {
                    pos += 2;
                    TokenKind::Op(Op::Lte)
                } else {
                    pos += 1;
                    TokenKind::Op(Op::Lt)
                }
            }

            '>' => {
                if chars.get(pos + 1) == Some(&'=') {
                    pos += 2;
                    TokenKind::Op(Op::Gte)
                } else {
                    pos += 1;
                    TokenKind::Op(Op::Gt)
                }
            }

            '=' => {
                pos += 1;
                TokenKind::Op(Op::Eq)
            }
            ':' => {
                pos += 1;
                TokenKind::Op(Op::Colon)
            }

            '"' => {
                pos += 1;
                let inner_start = pos;
                while pos < chars.len() && chars[pos] != '"' {
                    if chars[pos] == '\\' {
                        pos += 1;
                    }
                    pos += 1;
                }
                if pos >= chars.len() {
                    return Err(LexError("Unterminated quoted string".into()));
                }
                let value: String = chars[inner_start..pos].iter().collect();
                pos += 1;
                TokenKind::Value(value)
            }

            c if c.is_alphanumeric() || c == '_' || c == '*' || c == '/' || c == '.' => {
                let inner_start = pos;
                while pos < chars.len()
                    && (chars[pos].is_alphanumeric()
                        || chars[pos] == '_'
                        || chars[pos] == '-'
                        || chars[pos] == '.'
                        || chars[pos] == '*'
                        || chars[pos] == '/')
                {
                    pos += 1;
                }
                let word: String = chars[inner_start..pos].iter().collect();

                match word.to_uppercase().as_str() {
                    "AND" => TokenKind::And,
                    "OR" => TokenKind::Or,
                    "NOT" => TokenKind::Not,
                    _ => {
                        // Decide Ident vs Value based on what follows.
                        // If the very next non-space char is an operator, this is a field name.
                        let next_non_space = chars[pos..].iter().find(|&&c| c != ' ');
                        if matches!(
                            next_non_space,
                            Some(':') | Some('=') | Some('<') | Some('>') | Some('!')
                        ) {
                            TokenKind::Ident(word.to_lowercase())
                        } else {
                            TokenKind::Value(word)
                        }
                        // Value only if the previous token was an operator
                        // match tokens.last() {
                        //     Some(Token {
                        //         kind: TokenKind::Op(_),
                        //         ..
                        //     }) => TokenKind::Value(word),
                        //     _ => TokenKind::Ident(word.to_lowercase()),
                        // }
                    }
                }
            }

            other => {
                return Err(LexError(format!(
                    "Unexpected character '{other}' at position {pos}"
                )));
            }
        };

        tokens.push(Token {
            kind,
            start,
            end: pos,
        });
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_naked_ident() {
        let tokens = tokenize("n").unwrap();
        assert_eq!(
            tokens,
            vec![Token {
                kind: TokenKind::Value("n".into()),
                start: 0,
                end: 1
            },]
        );
    }

    #[test]
    fn test_negated_naked_ident() {
        let tokens = tokenize("-n").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Not,
                    start: 0,
                    end: 1
                },
                Token {
                    kind: TokenKind::Value("n".into()),
                    start: 1,
                    end: 2
                },
            ]
        );
    }

    #[test]
    fn test_basic_field_colon() {
        let tokens = tokenize("c:blue").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Ident("c".into()),
                    start: 0,
                    end: 1
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 1,
                    end: 2
                },
                Token {
                    kind: TokenKind::Value("blue".into()),
                    start: 2,
                    end: 6
                },
            ]
        );
    }

    #[test]
    fn test_gte_operator() {
        let tokens = tokenize("cmc>=3").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Ident("cmc".into()),
                    start: 0,
                    end: 3
                },
                Token {
                    kind: TokenKind::Op(Op::Gte),
                    start: 3,
                    end: 5
                },
                Token {
                    kind: TokenKind::Value("3".into()),
                    start: 5,
                    end: 6
                },
            ]
        );
    }

    #[test]
    fn test_boolean_keywords() {
        let tokens = tokenize("t:creature OR t:instant").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Ident("t".into()),
                    start: 0,
                    end: 1
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 1,
                    end: 2
                },
                Token {
                    kind: TokenKind::Value("creature".into()),
                    start: 2,
                    end: 10
                },
                Token {
                    kind: TokenKind::Or,
                    start: 11,
                    end: 13
                },
                Token {
                    kind: TokenKind::Ident("t".into()),
                    start: 14,
                    end: 15
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 15,
                    end: 16
                },
                Token {
                    kind: TokenKind::Value("instant".into()),
                    start: 16,
                    end: 23
                },
            ]
        );
    }

    #[test]
    fn test_quoted_value() {
        let tokens = tokenize(r#"name:"Serra Angel""#).unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Ident("name".into()),
                    start: 0,
                    end: 4
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 4,
                    end: 5
                },
                Token {
                    kind: TokenKind::Value("Serra Angel".into()),
                    start: 5,
                    end: 18
                },
            ]
        );
    }

    #[test]
    fn test_not_prefix() {
        let tokens = tokenize("-t:land").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Not,
                    start: 0,
                    end: 1
                },
                Token {
                    kind: TokenKind::Ident("t".into()),
                    start: 1,
                    end: 2
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 2,
                    end: 3
                },
                Token {
                    kind: TokenKind::Value("land".into()),
                    start: 3,
                    end: 7
                },
            ]
        );
    }

    #[test]
    fn test_regex_prefix() {
        let tokens = tokenize("o://").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token {
                    kind: TokenKind::Ident("o".into()),
                    start: 0,
                    end: 1
                },
                Token {
                    kind: TokenKind::Op(Op::Colon),
                    start: 1,
                    end: 2
                },
                Token {
                    kind: TokenKind::Value("//".into()),
                    start: 2,
                    end: 4
                },
            ]
        );
    }
}
