use crate::query_parser::planner::PlanError;

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
        match self {
            Self::SetType => true,
            Self::Set => {
                value.len() > 4
                    || value.contains(' ')
                    || !value.chars().all(|c| c.is_alphanumeric())
            }
            _ => false,
        }
    }

    pub fn is_print_field(&self) -> bool {
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
