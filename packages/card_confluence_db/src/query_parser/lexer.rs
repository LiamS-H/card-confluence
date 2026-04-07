#[derive(Debug, Clone, PartialEq)]
pub enum Op {
    Colon, // :  (contains / equals, Scryfall default)
    Eq,    // =
    Ne,    // !=
    Lt,    // <
    Lte,   // <=
    Gt,    // >
    Gte,   // >=
}

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
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
        match chars[pos] {
            ' ' | '\t' | '\n' | '\r' => {
                pos += 1;
            }

            '(' => {
                tokens.push(Token::LParen);
                pos += 1;
            }

            ')' => {
                tokens.push(Token::RParen);
                pos += 1;
            }

            // `-` as prefix NOT (must not be part of a number in value position)
            '-' if !matches!(tokens.last(), Some(Token::Value(_))) => {
                tokens.push(Token::Not);
                pos += 1;
            }

            // Operators: !=  <=  >=  <  >  =
            '!' => {
                if chars.get(pos + 1) == Some(&'=') {
                    tokens.push(Token::Op(Op::Ne));
                    pos += 2;
                } else {
                    return Err(LexError(format!("Unexpected '!' at position {pos}")));
                }
            }

            '<' => {
                if chars.get(pos + 1) == Some(&'=') {
                    tokens.push(Token::Op(Op::Lte));
                    pos += 2;
                } else {
                    tokens.push(Token::Op(Op::Lt));
                    pos += 1;
                }
            }

            '>' => {
                if chars.get(pos + 1) == Some(&'=') {
                    tokens.push(Token::Op(Op::Gte));
                    pos += 2;
                } else {
                    tokens.push(Token::Op(Op::Gt));
                    pos += 1;
                }
            }

            '=' => {
                tokens.push(Token::Op(Op::Eq));
                pos += 1;
            }

            ':' => {
                tokens.push(Token::Op(Op::Colon));
                pos += 1;
            }

            // Quoted string value
            '"' => {
                pos += 1; // skip opening quote
                let start = pos;
                while pos < chars.len() && chars[pos] != '"' {
                    if chars[pos] == '\\' {
                        pos += 1; // skip escape char
                    }
                    pos += 1;
                }
                if pos >= chars.len() {
                    return Err(LexError("Unterminated quoted string".into()));
                }
                let value: String = chars[start..pos].iter().collect();
                tokens.push(Token::Value(value));
                pos += 1; // skip closing quote
            }

            // Identifiers and bare values
            c if c.is_alphanumeric()
                || c == '_'
                || c == '*'
                || c == '/'
                || c == '.'
                || c == '-' =>
            {
                let start = pos;
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
                let word: String = chars[start..pos].iter().collect();

                // Resolve boolean keywords case-insensitively
                match word.to_uppercase().as_str() {
                    "AND" => tokens.push(Token::And),
                    "OR" => tokens.push(Token::Or),
                    "NOT" => tokens.push(Token::Not),
                    _ => {
                        // Decide Ident vs Value based on what follows.
                        // If the very next non-space char is an operator, this is a field name.
                        let next_non_space = chars[pos..].iter().find(|&&c| c != ' ');
                        if matches!(
                            next_non_space,
                            Some(':') | Some('=') | Some('<') | Some('>') | Some('!')
                        ) {
                            tokens.push(Token::Ident(word.to_lowercase()));
                        } else {
                            tokens.push(Token::Value(word));
                        }
                    }
                }
            }

            other => {
                return Err(LexError(format!(
                    "Unexpected character '{other}' at position {pos}"
                )));
            }
        }
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_field_colon() {
        let tokens = tokenize("c:blue").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Ident("c".into()),
                Token::Op(Op::Colon),
                Token::Value("blue".into()),
            ]
        );
    }

    #[test]
    fn test_gte_operator() {
        let tokens = tokenize("cmc>=3").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Ident("cmc".into()),
                Token::Op(Op::Gte),
                Token::Value("3".into()),
            ]
        );
    }

    #[test]
    fn test_boolean_keywords() {
        let tokens = tokenize("t:creature OR t:instant").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Ident("t".into()),
                Token::Op(Op::Colon),
                Token::Value("creature".into()),
                Token::Or,
                Token::Ident("t".into()),
                Token::Op(Op::Colon),
                Token::Value("instant".into()),
            ]
        );
    }

    #[test]
    fn test_quoted_value() {
        let tokens = tokenize(r#"name:"Serra Angel""#).unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Ident("name".into()),
                Token::Op(Op::Colon),
                Token::Value("Serra Angel".into()),
            ]
        );
    }

    #[test]
    fn test_not_prefix() {
        let tokens = tokenize("-t:land").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Not,
                Token::Ident("t".into()),
                Token::Op(Op::Colon),
                Token::Value("land".into()),
            ]
        );
    }
}
