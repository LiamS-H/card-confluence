use datafusion::logical_expr::{Expr as DFExpr, col, lit};

use crate::query_parser::{
    lexer::Op,
    planner::{
        PlanError,
        expression_matches::array_contains_expr,
        expression_vals::{exact_lower_text, numeric_lit, uuid_lit},
        expressions_pred::{
            color_pred, date_pred, eq_pred, field_pred, flexible_numeric_pred, is_pred,
            keyword_pred, legal_pred, ord_pred, powtou_pred, rarity_pred, text_pred,
        },
        mana_pred::mana_pred,
    },
};

/// A single field comparison: `field OP value`
#[derive(Debug, Clone, PartialEq)]
pub struct Predicate {
    pub field: String,
    pub op: Op,
    pub value: String,
    pub start: usize,
    pub end: usize,
}

impl Predicate {
    pub fn to_df_expr(&self) -> Result<DFExpr, PlanError> {
        let pred = self;
        let field = PredicateField::try_from(pred.field.as_str())?;
        let column_name = field
            .full_column()
            .ok_or(PlanError(format!("failed to get col name for {:?}", field)));

        match field {
            // Oracle-side (cards.*)
            PredicateField::Type => text_pred(&"cards.type_line", &pred.op, &pred.value),
            PredicateField::Mana => mana_pred(&"cards.mana_cost", &pred.op, &pred.value),
            PredicateField::Oracle | PredicateField::Name | PredicateField::Layout => {
                text_pred(&column_name?, &pred.op, &pred.value)
            }

            PredicateField::Power
            | PredicateField::Toughness
            | PredicateField::Loyalty
            | PredicateField::Defense => {
                flexible_numeric_pred(&column_name?, &pred.op, &pred.value)
            }
            PredicateField::Edhrec | PredicateField::Penny | PredicateField::Cmc => Ok(ord_pred(
                col(column_name?),
                &pred.op,
                numeric_lit(&pred.value)?,
            )),

            PredicateField::PowTou => powtou_pred(&pred.op, &pred.value),
            PredicateField::Color => color_pred(&column_name?, &pred.op, &pred.value, false),
            PredicateField::Identity => color_pred(&column_name?, &pred.op, &pred.value, true),
            PredicateField::Produces => color_pred(&column_name?, &pred.op, &pred.value, false),
            // could replace with the text array to allow partial matches, i don't think this is
            // actuall useful though
            PredicateField::OracleTag => Ok(array_contains_expr(&column_name?, lit(&pred.value))),
            PredicateField::Keyword => keyword_pred(&column_name?, &pred.op, &pred.value),
            PredicateField::Format => eq_pred(&pred.field, &pred.op, legal_pred(&pred.value)),
            PredicateField::Banned => eq_pred(
                &pred.field,
                &pred.op,
                field_pred(&column_name?, &pred.value, "banned"),
            ),
            PredicateField::Unrestricted => eq_pred(
                &pred.field,
                &pred.op,
                field_pred(&column_name?, &pred.value, "legal"),
            ),
            PredicateField::Restricted => eq_pred(
                &pred.field,
                &pred.op,
                field_pred(&column_name?, &pred.value, "restricted"),
            ),

            PredicateField::CollectorNumber => {
                Ok(ord_pred(col(column_name?), &pred.op, lit(&pred.value)))
            }
            PredicateField::Rarity => rarity_pred(&column_name?, &pred.op, &pred.value),

            PredicateField::Lang
            | PredicateField::SetType
            | PredicateField::Border
            | PredicateField::Frame
            | PredicateField::Stamp => Ok(exact_lower_text("sets.set_type", &pred.value)),

            PredicateField::Artist | PredicateField::FlavorText | PredicateField::Watermark => {
                todo!("need to add illustrations")
            }

            PredicateField::Year => date_pred(&column_name?, &pred.op, &pred.value),

            PredicateField::OracleId | PredicateField::ScryfallId => {
                Ok(col(&column_name?).eq(uuid_lit(&pred.value)?))
            }

            PredicateField::Game => eq_pred(
                &pred.field,
                &pred.op,
                array_contains_expr("prints.games", lit(pred.value.clone())),
            ),

            PredicateField::Set => {
                if pred.value.len() <= 4 && pred.value.chars().all(|c| c.is_alphanumeric()) {
                    Ok(exact_lower_text("prints.set_code", &pred.value))
                } else {
                    text_pred("sets.name", &pred.op, &pred.value)
                }
            }

            PredicateField::In => {
                let val = &pred.value;
                let expr = if matches!(
                    val.as_str(),
                    "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus"
                ) {
                    col("prints.rarity").eq(lit(&pred.value))
                } else if matches!(val.as_str(), "paper" | "arena" | "mtgo") {
                    array_contains_expr("prints.games", lit(val.clone()))
                } else {
                    col("prints.set_code").eq(lit(&pred.value))
                };

                eq_pred(&pred.field, &pred.op, expr)
            }

            PredicateField::Is => is_pred(&pred.value),

            PredicateField::Order
            | PredicateField::Dir
            | PredicateField::Unique
            | PredicateField::Prefer => Ok(lit(true)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PredicateField {
    Name,
    Type,
    Oracle,
    Mana,
    Power,
    Toughness,
    Loyalty,
    Defense,
    Edhrec,
    Penny,
    PowTou,
    Artist,
    FlavorText,
    Watermark,
    Border,
    Frame,
    Layout,
    Stamp,
    Color,
    Identity,
    Cmc,
    CollectorNumber,
    Rarity,
    SetType,
    Format,
    Banned,
    Restricted,
    Unrestricted,
    Is,
    In,
    Game,
    Lang,
    ScryfallId,
    OracleId,
    Produces,
    OracleTag,
    Keyword,
    Set,
    Year,
    Order,
    Dir,
    Unique,
    Prefer,
}

impl PredicateField {
    pub fn needs_set_table(&self, value: &str) -> bool {
        fn is_set_code(value: &str) -> bool {
            if value.len() > 3 {
                return false;
            }
            if value.contains(' ') {
                return false;
            }
            if !value.chars().all(|c| c.is_alphanumeric()) {
                return false;
            }
            return true;
        }

        match self {
            PredicateField::SetType => true,
            PredicateField::Set => !is_set_code(value),
            _ => false,
        }
    }

    pub fn needs_print_table(&self, value: &str) -> bool {
        fn is_print_flag(value: &str) -> bool {
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
        match self {
            PredicateField::Is => return is_print_flag(value),
            _ => self.is_print_field(),
        }
    }

    pub fn is_print_field(&self) -> bool {
        assert!(
            !matches!(self, Self::Is),
            "use needs_print_table() instead when dealing with is"
        );
        matches!(
            self,
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
        )
    }

    pub fn is_ord(&self) -> bool {
        matches!(
            self,
            PredicateField::Mana
                | PredicateField::Power
                | PredicateField::Toughness
                | PredicateField::Loyalty
                | PredicateField::Defense
                | PredicateField::Edhrec
                | PredicateField::Penny
                | PredicateField::Cmc
                | PredicateField::PowTou
                | PredicateField::Color
                | PredicateField::Identity
                | PredicateField::Produces
                | PredicateField::CollectorNumber
                | PredicateField::Rarity
                | PredicateField::Keyword
                | PredicateField::Year
        )
    }

    pub fn full_column(&self) -> Option<String> {
        let column_name = self.column_name()?;
        let table = if self.is_print_field() {
            "prints"
        } else {
            "cards"
        };
        return Some(format!("{}.{}", table, column_name));
    }

    pub fn column_name(&self) -> Option<&'static str> {
        match self {
            PredicateField::Is => None, // touches many fields

            PredicateField::Layout => Some("layout"),
            PredicateField::OracleId => Some("oracle_id"),

            PredicateField::Name => Some("name"),
            PredicateField::Cmc => Some("cmc"),
            PredicateField::Identity => Some("color_identity"),
            PredicateField::Color => Some("colors"),

            PredicateField::Edhrec => Some("edhrec_rank"),
            PredicateField::Penny => Some("penny_rank"),

            PredicateField::Power => Some("power"),
            PredicateField::Toughness => Some("toughness"),
            PredicateField::Loyalty => Some("loyalty"),
            PredicateField::Defense => Some("defense"),
            PredicateField::PowTou => None,

            PredicateField::OracleTag => Some("otags"),

            PredicateField::Keyword => Some("keywords"),
            PredicateField::Format => Some("legalities"),
            PredicateField::Banned => Some("legalities"),
            PredicateField::Restricted => Some("legalities"),
            PredicateField::Unrestricted => Some("legalities"),
            PredicateField::Mana => Some("mana_cost"),
            PredicateField::Oracle => Some("oracle_text"),
            PredicateField::Produces => Some("produced_mana"),

            PredicateField::Type => None, // could just be type_line when filtering, but when grabbing types should grab from: type_line, super_types, sub_types

            PredicateField::In => Some("rarity"),
            PredicateField::Artist => None, // artist, within Illustration
            PredicateField::FlavorText => None, // flavor_text, within Illustration
            PredicateField::Watermark => None, // watermark, within Illustration
            PredicateField::Border => Some("border"),
            PredicateField::Frame => Some("frame"),
            PredicateField::Stamp => Some("stamp"),
            PredicateField::CollectorNumber => Some("collector_number"),
            PredicateField::Rarity => Some("rarity"),
            PredicateField::SetType => None, // "set_type" on sets

            PredicateField::Game => Some("game"),
            PredicateField::Lang => Some("lang"),
            PredicateField::ScryfallId => Some("scryfall_id"),
            PredicateField::Set => None, // references set and set name
            PredicateField::Year => Some("released_at"),

            PredicateField::Order
            | PredicateField::Dir
            | PredicateField::Unique
            | PredicateField::Prefer => None,
        }
    }
}

impl TryFrom<&str> for PredicateField {
    type Error = PlanError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "name" | "n" => Ok(Self::Name),
            "type" | "t" => Ok(Self::Type),
            "oracle" | "o" => Ok(Self::Oracle),
            "mana" | "m" => Ok(Self::Mana),
            "pow" | "power" => Ok(Self::Power),
            "tou" | "toughness" => Ok(Self::Toughness),
            "loy" | "loyalty" => Ok(Self::Loyalty),
            "def" | "defense" => Ok(Self::Defense),
            "edhrec" => Ok(Self::Edhrec),
            "penny" => Ok(Self::Penny),
            "pt" | "powtou" => Ok(Self::PowTou),
            "a" | "artist" => Ok(Self::Artist),
            "flavor" | "ft" => Ok(Self::FlavorText),
            "wm" | "watermark" => Ok(Self::Watermark),
            "border" => Ok(Self::Border),
            "frame" => Ok(Self::Frame),
            "layout" => Ok(Self::Layout),
            "stamp" => Ok(Self::Stamp),
            "color" | "c" => Ok(Self::Color),
            "identity" | "ci" | "id" => Ok(Self::Identity),
            "cmc" | "mv" | "manavalue" => Ok(Self::Cmc),
            "cn" | "number" => Ok(Self::CollectorNumber),
            "r" | "rarity" => Ok(Self::Rarity),
            "st" | "settype" => Ok(Self::SetType),
            "f" | "format" | "legal" => Ok(Self::Format),
            "banned" => Ok(Self::Banned),
            "restricted" => Ok(Self::Restricted),
            "unrestricted" => Ok(Self::Unrestricted),
            "is" => Ok(Self::Is),
            "in" => Ok(Self::In),
            "game" => Ok(Self::Game),
            "lang" | "l" => Ok(Self::Lang),
            "scryfallid" => Ok(Self::ScryfallId),
            "oracleid" => Ok(Self::OracleId),
            "produces" => Ok(Self::Produces),
            "otag" | "oracle_tag" => Ok(Self::OracleTag),
            "kw" | "keyword" => Ok(Self::Keyword),
            "s" | "set" | "e" | "edition" => Ok(Self::Set),
            "year" | "date" => Ok(Self::Year),
            "order" | "sort" => Ok(Self::Order),
            "dir" | "direction" => Ok(Self::Dir),
            "unique" => Ok(Self::Unique),
            "prefer" => Ok(Self::Prefer),
            other => Err(PlanError(format!("Unknown Scryfall field: '{other}'"))),
        }
    }
}
