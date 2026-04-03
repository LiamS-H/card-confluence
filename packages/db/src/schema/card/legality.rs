use arrow::array::ArrayBuilder;
use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[arrow_field(type = "dense")]
pub enum Legality {
    Legal,
    NotLegal,
    Restricted,
    Banned,
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Legalities {
    pub standard: Option<Legality>,
    pub pioneer: Option<Legality>,
    pub modern: Option<Legality>,
    pub legacy: Option<Legality>,
    pub vintage: Option<Legality>,
    pub commander: Option<Legality>,
    pub oathbreaker: Option<Legality>,
    pub brawl: Option<Legality>,
    pub historic: Option<Legality>,
    pub alchemy: Option<Legality>,
    pub explorer: Option<Legality>,
    pub pauper: Option<Legality>,
    pub penny: Option<Legality>,
    pub duel: Option<Legality>,
    pub oldschool: Option<Legality>,
    pub premodern: Option<Legality>,
    pub predh: Option<Legality>,
    pub paupercommander: Option<Legality>,
    pub timeless: Option<Legality>,
    pub standardbrawl: Option<Legality>,
}
