use scryfall_rust_bindings::types::{
    card::{
        ScryfallCard, ScryfallCardFace, ScryfallImageUris, ScryfallLegalities, ScryfallPreview,
        ScryfallPrices, ScryfallPurchaseUris, ScryfallRelatedCard,
    },
    ruling::ScryfallRuling,
    set::ScryfallSet,
};

use crate::{
    schema::{
        card::{
            card::{Card, CardFace},
            image::ImageUris,
            legality::Legalities,
            preview::Preview,
            price::{Prices, PurchaseUris},
            print::{Illustration, Print},
            related::RelatedCard,
        },
        ruling::Ruling,
        set::Set,
    },
    utils::KNOWN_SUPERTYPES,
};

impl From<ScryfallCardFace> for CardFace {
    fn from(scryfall: ScryfallCardFace) -> Self {
        let type_line = scryfall.type_line.unwrap_or("".into());
        let Types {
            sub_types,
            super_types,
            card_types,
        } = types_from_type_line(&type_line);
        Self {
            cmc: scryfall.cmc.map(|c| c as f32),
            color_indicator: scryfall.color_indicator,
            colors: scryfall.colors,
            defense: scryfall.defense,
            loyalty: scryfall.loyalty,
            mana_cost: scryfall.mana_cost,
            name: scryfall.name,
            oracle_text: scryfall.oracle_text,
            power: scryfall.power,
            toughness: scryfall.toughness,
            type_line,
            card_types,
            sub_types,
            super_types,
        }
    }
}

struct Types {
    sub_types: Vec<String>,
    super_types: Vec<String>,
    card_types: Vec<String>,
}
fn types_from_type_line(type_line: &String) -> Types {
    let mut sub_types: Vec<String> = Vec::new();
    let mut super_types: Vec<String> = Vec::new();
    let mut card_types: Vec<String> = Vec::new();

    let parts: Vec<&str> = type_line.split(" — ").collect();

    if let Some(left) = parts.first() {
        for word in left.split_whitespace() {
            if KNOWN_SUPERTYPES.contains(&word) {
                super_types.push(word.to_string());
            } else {
                card_types.push(word.to_string());
            }
        }
    }

    if let Some(right) = parts.get(1) {
        for word in right.split_whitespace() {
            sub_types.push(word.to_string());
        }
    }
    return Types {
        sub_types,
        super_types,
        card_types,
    };
}

impl From<ScryfallCard> for Card {
    fn from(scryfall: ScryfallCard) -> Self {
        let type_line = scryfall.type_line.unwrap_or("".into());
        let Types {
            sub_types,
            super_types,
            card_types,
        } = types_from_type_line(&type_line);
        Self {
            layout: scryfall.layout,
            oracle_id: scryfall.oracle_id.unwrap_or_else(|| {
                scryfall
                    .card_faces
                    .clone()
                    .unwrap()
                    .first()
                    .unwrap()
                    .oracle_id
                    .clone()
                    .unwrap()
            }),
            all_parts: scryfall
                .all_parts
                .map(|v| v.into_iter().map(Into::into).collect()),
            cmc: scryfall.cmc.unwrap_or_else(|| {
                scryfall
                    .card_faces
                    .clone()
                    .unwrap()
                    .first()
                    .unwrap()
                    .cmc
                    .unwrap()
            }) as f32,
            card_faces: scryfall
                .card_faces
                .map(|v| v.into_iter().map(Into::into).collect()),
            color_identity: scryfall.color_identity,
            color_indicator: scryfall.color_indicator,
            colors: scryfall.colors.unwrap_or(Vec::new()),
            defense: scryfall.defense,
            edhrec_rank: scryfall.edhrec_rank,
            game_changer: scryfall.game_changer.unwrap_or(false),
            keywords: scryfall.keywords,
            legalities: scryfall.legalities.into(),
            loyalty: scryfall.loyalty,
            mana_cost: scryfall.mana_cost,
            name: scryfall.name,
            oracle_text: scryfall.oracle_text,
            penny_rank: scryfall.penny_rank,
            power: scryfall.power,
            produced_mana: scryfall.produced_mana,
            reserved: scryfall.reserved,
            toughness: scryfall.toughness,
            type_line,
            card_types,
            super_types,
            sub_types,
            otags: Vec::new(),
            preview: scryfall.preview.map(Into::into),
        }
    }
}

impl From<ScryfallCardFace> for Illustration {
    fn from(face: ScryfallCardFace) -> Self {
        let mut artist_ids = Vec::new();
        if let Some(artist_id) = face.artist_id {
            artist_ids.push(artist_id);
        };
        Self {
            illustration_id: face.illustration_id,
            artist: face.artist,
            artist_ids,
            watermark: face.watermark,
            flavor_text: face.flavor_text,
            printed_name: face.printed_name,
            printed_text: face.printed_text,
            printed_type_line: face.printed_type_line,
            image_uris: face.image_uris.map(Into::into),
        }
    }
}
impl From<ScryfallCard> for Illustration {
    fn from(card: ScryfallCard) -> Self {
        Self {
            illustration_id: card.illustration_id,
            artist: card.artist,
            artist_ids: card.artist_ids.unwrap_or(Vec::new()),
            watermark: card.watermark,
            flavor_text: card.flavor_text,
            printed_name: card.printed_name,
            printed_text: card.printed_text,
            printed_type_line: card.printed_type_line,
            image_uris: card.image_uris.map(Into::into),
        }
    }
}

impl From<ScryfallCard> for Print {
    fn from(scryfall: ScryfallCard) -> Self {
        let mut illustrations = Vec::new();
        for face in scryfall.card_faces.clone().unwrap_or(vec![]) {
            illustrations.push(face.into());
        }
        if illustrations.len() == 0 {
            illustrations.push(scryfall.clone().into())
        }

        let card: Card = scryfall.clone().into();

        Self {
            oracle_id: card.oracle_id.clone(),
            scryfall_id: scryfall.id,
            lang: scryfall.lang,
            arena_id: scryfall.arena_id,
            mtgo_id: scryfall.mtgo_id,
            mtgo_foil_id: scryfall.mtgo_foil_id,
            multiverse_ids: scryfall.multiverse_ids,
            tcgplayer_id: scryfall.tcgplayer_id,
            tcgplayer_etched_id: scryfall.tcgplayer_etched_id,
            cardmarket_id: scryfall.cardmarket_id,
            collector_number: scryfall.collector_number,
            set_code: scryfall.set,
            released_at: scryfall.released_at,
            reprint: scryfall.reprint,
            booster: scryfall.booster,
            promo: scryfall.promo,
            digital: scryfall.digital,
            oversized: scryfall.oversized,
            story_spotlight: scryfall.story_spotlight,
            textless: scryfall.textless,
            promo_types: scryfall.promo_types,
            rarity: scryfall.rarity,
            games: scryfall.games,
            finishes: scryfall.finishes,
            security_stamp: scryfall.security_stamp,
            frame: scryfall.frame,
            full_art: scryfall.full_art,
            card_back_id: scryfall.card_back_id,
            border_color: scryfall.border_color,
            content_warning: scryfall.content_warning.unwrap_or(false),
            illustrations,
            artist_ids: scryfall.artist_ids,
            flavor_name: scryfall.flavor_name,
            frame_effects: scryfall.frame_effects,
            image_status: scryfall.image_status,
            highres_image: scryfall.highres_image,
            variation: scryfall.variation,
            variation_of: scryfall.variation_of,
            purchase_uris: scryfall.purchase_uris.map(Into::into),
            prices: scryfall.prices.into(),
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

impl From<ScryfallRelatedCard> for RelatedCard {
    fn from(scryfall: ScryfallRelatedCard) -> Self {
        Self {
            id: scryfall.id,
            // object: scryfall.object,
            component: scryfall.component,
            name: scryfall.name,
            type_line: scryfall.type_line,
        }
    }
}

impl From<ScryfallSet> for Set {
    fn from(scryfall: ScryfallSet) -> Self {
        Self {
            name: scryfall.name,
            set_type: scryfall.set_type,
            code: scryfall.code,
            id: scryfall.id,
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
