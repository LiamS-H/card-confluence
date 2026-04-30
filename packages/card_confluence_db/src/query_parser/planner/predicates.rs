use datafusion::logical_expr::{col, lit, Expr as DFExpr};

use crate::query_parser::{
    lexer::Op,
    planner::{
        expressions::{
            array_contains_expr, color_pred, exact_pred, flexible_numeric_pred, format_pred,
            is_pred, numeric_pred, powtou_pred, text_pred,
        },
        PlanError,
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
            //TODO: make an intermediate struct like {r:3, c:2} and then convert the string to this type for integer comparison;
            // this will also make this the only field that will need to be compared across card faces
            PredicateField::Mana => text_pred(&"cards.mana_cost", &pred.op, &pred.value),
            PredicateField::Oracle | PredicateField::Name | PredicateField::Layout => {
                text_pred(&column_name?, &pred.op, &pred.value)
            }

            PredicateField::Power
            | PredicateField::Toughness
            | PredicateField::Loyalty
            | PredicateField::Defense => {
                flexible_numeric_pred(&column_name?, &pred.op, &pred.value)
            }
            PredicateField::Edhrec | PredicateField::Penny | PredicateField::Cmc => {
                numeric_pred(&column_name?, &pred.op, &pred.value)
            }

            PredicateField::PowTou => powtou_pred(&pred.op, &pred.value),
            PredicateField::Color | PredicateField::Identity => {
                color_pred(&column_name?, &pred.op, &pred.value)
            }
            PredicateField::OracleId => exact_pred("cards.oracle_id", &pred.value),
            PredicateField::Produces | PredicateField::OracleTag | PredicateField::Keyword => Ok(
                array_contains_expr(&column_name?, lit(pred.value.to_lowercase())),
            ),
            PredicateField::Format => format_pred(&pred.value),

            // Print-side (prints.*)
            PredicateField::Artist
            | PredicateField::FlavorText
            | PredicateField::Watermark
            | PredicateField::Border
            | PredicateField::Frame
            | PredicateField::Stamp
            | PredicateField::Year => text_pred(&column_name?, &pred.op, &pred.value),

            PredicateField::CollectorNumber
            | PredicateField::Rarity
            | PredicateField::Lang
            | PredicateField::ScryfallId => exact_pred(&column_name?, &pred.value),

            PredicateField::Game => Ok(array_contains_expr(
                "prints.games",
                lit(pred.value.to_lowercase()),
            )),

            PredicateField::Set => {
                if pred.value.len() <= 4 && pred.value.chars().all(|c| c.is_alphanumeric()) {
                    Ok(col("prints.set_code").eq(lit(pred.value.to_lowercase())))
                } else {
                    text_pred("sets.name", &pred.op, &pred.value)
                }
            }

            PredicateField::In => {
                let val = pred.value.to_lowercase();
                if matches!(
                    val.as_str(),
                    "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus"
                ) {
                    exact_pred("prints.rarity", &pred.value)
                } else if matches!(val.as_str(), "paper" | "arena" | "mtgo") {
                    Ok(array_contains_expr("prints.games", lit(val)))
                } else {
                    exact_pred("prints.set_code", &pred.value)
                }
            }

            // Set-table (sets.*)
            PredicateField::SetType => exact_pred("sets.set_type", &pred.value),

            // Mixed / special
            PredicateField::Is => is_pred(&pred.value),
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
        }
    }
}

impl TryFrom<&str> for PredicateField {
    type Error = PlanError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
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
            other => Err(PlanError(format!("Unknown Scryfall field: '{other}'"))),
        }
    }
}
