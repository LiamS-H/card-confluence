use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallCardList {
    pub total_cards: u32,
    pub has_more: bool,
    pub next_page: Option<String>,
    pub data: Vec<ScryfallCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallImageUris {
    pub small: Option<String>,
    pub normal: Option<String>,
    pub large: Option<String>,
    pub png: Option<String>,
    pub art_crop: Option<String>,
    pub border_crop: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallPrices {
    pub usd: Option<String>,
    pub usd_foil: Option<String>,
    pub usd_etched: Option<String>,
    pub eur: Option<String>,
    pub eur_foil: Option<String>,
    pub eur_etched: Option<String>,
    pub tix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallPurchaseUris {
    pub tcgplayer: Option<String>,
    pub cardmarket: Option<String>,
    pub cardhoarder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallRelatedUris {
    pub gatherer: Option<String>,
    pub tcgplayer_infinite_articles: Option<String>,
    pub tcgplayer_infinite_decks: Option<String>,
    pub edhrec: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallLegalities {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallPreview {
    pub previewed_at: Option<String>,
    pub source_uri: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallCardFace {
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cmc: Option<f64>,
    pub color_indicator: Option<Vec<String>>,
    pub colors: Option<Vec<String>>,
    pub defense: Option<String>,
    pub flavor_text: Option<String>,
    pub illustration_id: Option<String>,
    pub image_uris: Option<ScryfallImageUris>,
    pub layout: Option<String>,
    pub loyalty: Option<String>,
    pub mana_cost: String,
    pub name: String,
    pub object: String,
    pub oracle_id: Option<String>,
    pub oracle_text: Option<String>,
    pub power: Option<String>,
    pub printed_name: Option<String>,
    pub printed_text: Option<String>,
    pub printed_type_line: Option<String>,
    pub toughness: Option<String>,
    pub type_line: Option<String>,
    pub watermark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallRelatedCard {
    pub id: String,
    pub object: String,
    pub component: String,
    pub name: String,
    pub type_line: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScryfallCard {
    pub arena_id: Option<i32>,
    pub id: String,
    pub lang: String,
    pub mtgo_id: Option<i32>,
    pub mtgo_foil_id: Option<i32>,
    pub multiverse_ids: Option<Vec<i32>>,
    pub resource_id: Option<String>,
    pub tcgplayer_id: Option<i32>,
    pub tcgplayer_etched_id: Option<i32>,
    pub cardmarket_id: Option<i32>,
    pub object: String,
    pub layout: String,
    pub oracle_id: Option<String>,
    pub prints_search_uri: String,
    pub rulings_uri: String,
    pub scryfall_uri: String,
    pub uri: String,
    pub all_parts: Option<Vec<ScryfallRelatedCard>>,
    pub card_faces: Option<Vec<ScryfallCardFace>>,
    pub cmc: f64,
    pub color_identity: Vec<String>,
    pub color_indicator: Option<Vec<String>>,
    pub colors: Option<Vec<String>>,
    pub defense: Option<String>,
    pub edhrec_rank: Option<i32>,
    pub game_changer: Option<bool>,
    pub hand_modifier: Option<String>,
    pub keywords: Vec<String>,
    pub legalities: ScryfallLegalities,
    pub life_modifier: Option<String>,
    pub loyalty: Option<String>,
    pub mana_cost: Option<String>,
    pub name: String,
    pub oracle_text: Option<String>,
    pub penny_rank: Option<i32>,
    pub power: Option<String>,
    pub produced_mana: Option<Vec<String>>,
    pub reserved: bool,
    pub toughness: Option<String>,
    pub type_line: String,
    pub artist: Option<String>,
    pub artist_ids: Option<Vec<String>>,
    pub attraction_lights: Option<Vec<i32>>,
    pub booster: bool,
    pub border_color: String,
    pub card_back_id: Option<String>,
    pub collector_number: String,
    pub content_warning: Option<bool>,
    pub digital: bool,
    pub finishes: Vec<String>,
    pub flavor_name: Option<String>,
    pub flavor_text: Option<String>,
    pub frame_effects: Option<Vec<String>>,
    pub frame: String,
    pub full_art: bool,
    pub games: Vec<String>,
    pub highres_image: bool,
    pub illustration_id: Option<String>,
    pub image_status: String,
    pub image_uris: Option<ScryfallImageUris>,
    pub oversized: bool,
    pub prices: ScryfallPrices,
    pub printed_name: Option<String>,
    pub printed_text: Option<String>,
    pub printed_type_line: Option<String>,
    pub promo: bool,
    pub promo_types: Option<Vec<String>>,
    pub purchase_uris: Option<ScryfallPurchaseUris>,
    pub rarity: String,
    pub related_uris: ScryfallRelatedUris,
    pub released_at: String,
    pub reprint: bool,
    pub scryfall_set_uri: String,
    pub set_name: String,
    pub set_search_uri: String,
    pub set_type: String,
    pub set_uri: String,
    pub set: String,
    pub set_id: String,
    pub story_spotlight: bool,
    pub textless: bool,
    pub variation: bool,
    pub variation_of: Option<String>,
    pub security_stamp: Option<String>,
    pub watermark: Option<String>,
    pub preview: Option<ScryfallPreview>,
}
