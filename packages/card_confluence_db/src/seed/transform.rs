use scryfall_rust_bindings::types::{
    card::{
        ScryfallCard, ScryfallCardFace, ScryfallImageUris, ScryfallLegalities, ScryfallPreview,
        ScryfallPrices, ScryfallPurchaseUris, ScryfallRelatedCard, ScryfallRelatedUris,
    },
    ruling::ScryfallRuling,
    set::ScryfallSet,
};

use crate::schema::{
    card::{
        card::{Card, CardFace},
        image::ImageUris,
        legality::Legalities,
        preview::Preview,
        price::{Prices, PurchaseUris},
        related::{RelatedCard, RelatedUris},
    },
    ruling::Ruling,
    set::Set,
};

impl From<ScryfallCardFace> for CardFace {
    fn from(scryfall: ScryfallCardFace) -> Self {
        Self {
            artist: scryfall.artist,
            artist_id: scryfall.artist_id,
            cmc: scryfall.cmc.map(|c| c as f32),
            color_indicator: scryfall.color_indicator,
            colors: scryfall.colors,
            defense: scryfall.defense,
            flavor_text: scryfall.flavor_text,
            illustration_id: scryfall.illustration_id,
            image_uris: scryfall.image_uris.map(Into::into),
            layout: scryfall.layout,
            loyalty: scryfall.loyalty,
            mana_cost: scryfall.mana_cost,
            name: scryfall.name,
            object: scryfall.object,
            oracle_id: scryfall.oracle_id,
            oracle_text: scryfall.oracle_text,
            power: scryfall.power,
            printed_name: scryfall.printed_name,
            printed_text: scryfall.printed_text,
            printed_type_line: scryfall.printed_type_line,
            toughness: scryfall.toughness,
            type_line: scryfall.type_line,
            watermark: scryfall.watermark,
        }
    }
}

impl From<ScryfallCard> for Card {
    // type Error = &'static str;
    // fn try_from(scryfall: ScryfallCard) -> Result<Self, Self::Error> {
    fn from(scryfall: ScryfallCard) -> Self {
        // if scryfall.card_back_id.is_none() {
        //     return Err("Missing CardBack");
        // }
        Self {
            arena_id: scryfall.arena_id,
            id: scryfall.id,
            lang: scryfall.lang,
            mtgo_id: scryfall.mtgo_id,
            mtgo_foil_id: scryfall.mtgo_foil_id,
            multiverse_ids: scryfall.multiverse_ids,
            resource_id: scryfall.resource_id,
            tcgplayer_id: scryfall.tcgplayer_id,
            tcgplayer_etched_id: scryfall.tcgplayer_etched_id,
            cardmarket_id: scryfall.cardmarket_id,
            object: scryfall.object,
            layout: scryfall.layout,
            oracle_id: scryfall.oracle_id,
            all_parts: scryfall
                .all_parts
                .map(|v| v.into_iter().map(Into::into).collect()),
            card_faces: scryfall
                .card_faces
                .map(|v| v.into_iter().map(Into::into).collect()),
            cmc: scryfall.cmc as f32,
            color_identity: scryfall.color_identity,
            color_indicator: scryfall.color_indicator,
            colors: scryfall.colors,
            defense: scryfall.defense,
            edhrec_rank: scryfall.edhrec_rank,
            game_changer: scryfall.game_changer,
            hand_modifier: scryfall.hand_modifier,
            keywords: scryfall.keywords,
            legalities: scryfall.legalities.into(),
            life_modifier: scryfall.life_modifier,
            loyalty: scryfall.loyalty,
            mana_cost: scryfall.mana_cost,
            name: scryfall.name,
            oracle_text: scryfall.oracle_text,
            penny_rank: scryfall.penny_rank,
            power: scryfall.power,
            produced_mana: scryfall.produced_mana,
            reserved: scryfall.reserved,
            toughness: scryfall.toughness,
            type_line: scryfall.type_line,
            otags: Vec::new(),
            artist: scryfall.artist,
            artist_ids: scryfall.artist_ids,
            attraction_lights: scryfall.attraction_lights,
            booster: scryfall.booster,
            border_color: scryfall.border_color,
            card_back_id: scryfall
                .card_back_id
                .unwrap_or("0aeebaf5-8c7d-4636-9e82-8c27447861f7".into()),
            collector_number: scryfall.collector_number,
            content_warning: scryfall.content_warning,
            digital: scryfall.digital,
            finishes: scryfall.finishes,
            flavor_name: scryfall.flavor_name,
            flavor_text: scryfall.flavor_text,
            frame_effects: scryfall.frame_effects,
            frame: scryfall.frame,
            full_art: scryfall.full_art,
            games: scryfall.games,
            highres_image: scryfall.highres_image,
            illustration_id: scryfall.illustration_id,
            image_status: scryfall.image_status,
            image_uris: scryfall.image_uris.map(Into::into),
            oversized: scryfall.oversized,
            prices: scryfall.prices.into(),
            printed_name: scryfall.printed_name,
            printed_text: scryfall.printed_text,
            printed_type_line: scryfall.printed_type_line,
            promo: scryfall.promo,
            promo_types: scryfall.promo_types,
            purchase_uris: scryfall.purchase_uris.map(Into::into),
            rarity: scryfall.rarity,
            related_uris: scryfall.related_uris.into(),
            released_at: scryfall.released_at,
            reprint: scryfall.reprint,
            story_spotlight: scryfall.story_spotlight,
            textless: scryfall.textless,
            variation: scryfall.variation,
            variation_of: scryfall.variation_of,
            security_stamp: scryfall.security_stamp,
            watermark: scryfall.watermark,
            preview: scryfall.preview.map(Into::into),
        }
    }
}

impl From<ScryfallImageUris> for ImageUris {
    fn from(scryfall: ScryfallImageUris) -> Self {
        Self {
            small: scryfall.small,
            normal: scryfall.normal,
            large: scryfall.large,
            png: scryfall.png,
            art_crop: scryfall.art_crop,
            border_crop: scryfall.border_crop,
        }
    }
}

impl From<ScryfallLegalities> for Legalities {
    fn from(scryfall: ScryfallLegalities) -> Self {
        Self {
            standard: scryfall.standard.map(Into::into),
            pioneer: scryfall.pioneer.map(Into::into),
            modern: scryfall.modern.map(Into::into),
            legacy: scryfall.legacy.map(Into::into),
            vintage: scryfall.vintage.map(Into::into),
            commander: scryfall.commander.map(Into::into),
            oathbreaker: scryfall.oathbreaker.map(Into::into),
            brawl: scryfall.brawl.map(Into::into),
            historic: scryfall.historic.map(Into::into),
            alchemy: scryfall.alchemy.map(Into::into),
            explorer: scryfall.explorer.map(Into::into),
            pauper: scryfall.pauper.map(Into::into),
            penny: scryfall.penny.map(Into::into),
            duel: scryfall.duel.map(Into::into),
            oldschool: scryfall.oldschool.map(Into::into),
            premodern: scryfall.premodern.map(Into::into),
            predh: scryfall.predh.map(Into::into),
            paupercommander: scryfall.paupercommander.map(Into::into),
            timeless: scryfall.timeless.map(Into::into),
            standardbrawl: scryfall.standardbrawl.map(Into::into),
        }
    }
}

impl From<ScryfallPreview> for Preview {
    fn from(scryfall: ScryfallPreview) -> Self {
        Self {
            previewed_at: scryfall.previewed_at,
            source_uri: scryfall.source_uri,
            source: scryfall.source,
        }
    }
}

impl From<ScryfallPrices> for Prices {
    fn from(scryfall: ScryfallPrices) -> Self {
        Self {
            usd: scryfall.usd.and_then(|s| s.parse().ok()),
            usd_foil: scryfall.usd_foil.and_then(|s| s.parse().ok()),
            usd_etched: scryfall.usd_etched.and_then(|s| s.parse().ok()),
            eur: scryfall.eur.and_then(|s| s.parse().ok()),
            eur_foil: scryfall.eur_foil.and_then(|s| s.parse().ok()),
            eur_etched: scryfall.eur_etched.and_then(|s| s.parse().ok()),
            tix: scryfall.tix.and_then(|s| s.parse().ok()),
        }
    }
}

impl From<ScryfallPurchaseUris> for PurchaseUris {
    fn from(scryfall: ScryfallPurchaseUris) -> Self {
        Self {
            tcgplayer: scryfall.tcgplayer,
            cardmarket: scryfall.cardmarket,
            cardhoarder: scryfall.cardhoarder,
        }
    }
}

impl From<ScryfallRelatedUris> for RelatedUris {
    fn from(scryfall: ScryfallRelatedUris) -> Self {
        Self {
            gatherer: scryfall.gatherer,
            tcgplayer_infinite_articles: scryfall.tcgplayer_infinite_articles,
            tcgplayer_infinite_decks: scryfall.tcgplayer_infinite_decks,
            edhrec: scryfall.edhrec,
        }
    }
}

impl From<ScryfallRelatedCard> for RelatedCard {
    fn from(scryfall: ScryfallRelatedCard) -> Self {
        Self {
            id: scryfall.id,
            object: scryfall.object,
            component: scryfall.component,
            name: scryfall.name,
            type_line: scryfall.type_line,
            uri: scryfall.uri,
        }
    }
}

impl From<ScryfallSet> for Set {
    fn from(scryfall: ScryfallSet) -> Self {
        Self {
            set_name: scryfall.name,
            set_type: scryfall.set_type,
            set: scryfall.code,
            set_id: scryfall.id,
        }
    }
}
impl From<ScryfallRuling> for Ruling {
    fn from(scryfall: ScryfallRuling) -> Self {
        Self {
            oracle_id: scryfall.oracle_id,
            source: scryfall.source,
            published_at: scryfall.published_at,
            comment: scryfall.comment,
        }
    }
}
