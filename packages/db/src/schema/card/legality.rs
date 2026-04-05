use arrow::array::Int8Builder;
use arrow_array::Int8Array;
use arrow_convert::{
    deserialize::ArrowDeserialize, field::ArrowField, serialize::ArrowSerialize, ArrowDeserialize,
    ArrowField, ArrowSerialize,
};
use arrow_schema::DataType;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum Legality {
    Legal,
    NotLegal,
    Restricted,
    Banned,
}
impl ArrowField for Legality {
    type Type = Self;
    fn data_type() -> DataType {
        DataType::Int8
    }
}

impl ArrowSerialize for Legality {
    type ArrayBuilderType = Int8Builder;

    fn arrow_serialize(
        v: &<Self as ArrowField>::Type,
        array: &mut Self::ArrayBuilderType,
    ) -> Result<(), arrow_schema::ArrowError> {
        let val = match v {
            Legality::Legal => 0,
            Legality::NotLegal => 1,
            Legality::Restricted => 2,
            Legality::Banned => 3,
        };
        array.append_value(val);
        Ok(())
    }

    fn new_array() -> Self::ArrayBuilderType {
        todo!()
    }
}

impl ArrowDeserialize for Legality {
    type ArrayType = Int8Array;

    fn arrow_deserialize(
        v: <Self::ArrayType as arrow_convert::deserialize::ArrowArrayIterable>::Item<'_>,
    ) -> Option<<Self as ArrowField>::Type> {
        let Some(int) = v else {
            return None;
        };
        match int {
            0 => Some(Legality::Legal),
            1 => Some(Legality::NotLegal),
            2 => Some(Legality::Restricted),
            3 => Some(Legality::Banned),
            _ => None,
        }
    }
}

impl From<String> for Legality {
    fn from(s: String) -> Self {
        match s.as_str() {
            "legal" => Self::Legal,
            "not_legal" => Self::NotLegal,
            "restricted" => Self::Restricted,
            "banned" => Self::Banned,
            _ => Self::NotLegal,
        }
    }
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Legalities {
    // pub standard: Option<Legality>,
    // pub pioneer: Option<Legality>,
    // pub modern: Option<Legality>,
    // pub legacy: Option<Legality>,
    // pub vintage: Option<Legality>,
    // pub commander: Option<Legality>,
    // pub oathbreaker: Option<Legality>,
    // pub brawl: Option<Legality>,
    // pub historic: Option<Legality>,
    // pub alchemy: Option<Legality>,
    // pub explorer: Option<Legality>,
    // pub pauper: Option<Legality>,
    // pub penny: Option<Legality>,
    // pub duel: Option<Legality>,
    // pub oldschool: Option<Legality>,
    // pub premodern: Option<Legality>,
    // pub predh: Option<Legality>,
    // pub paupercommander: Option<Legality>,
    // pub timeless: Option<Legality>,
    // pub standardbrawl: Option<Legality>,
    pub standard: Option<String>,
    pub pioneer: Option<String>,
    pub modern: Option<String>,
    pub legacy: Option<String>,
    pub vintage: Option<String>,
    pub commander: Option<String>,
    pub oathbreaker: Option<String>,
    pub brawl: Option<String>,
    pub historic: Option<String>,
    pub alchemy: Option<String>,
    pub explorer: Option<String>,
    pub pauper: Option<String>,
    pub penny: Option<String>,
    pub duel: Option<String>,
    pub oldschool: Option<String>,
    pub premodern: Option<String>,
    pub predh: Option<String>,
    pub paupercommander: Option<String>,
    pub timeless: Option<String>,
    pub standardbrawl: Option<String>,
}
