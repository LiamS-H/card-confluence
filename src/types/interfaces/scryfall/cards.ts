interface IScryfallCardResult {
    object: 'list';

    total_cards: number;
    has_more: boolean;
    next_page: string;
    data: IScryfallCard[];
}

interface IScryfallError {
    object: 'error';

    code: string;
    status: number;
    warnings: string[];
    details: string;
}

interface IScryfallCardFace {
    object: 'card_face';

    name: string;
    mana_cost: string;
    power: string;
    toughness: string;

    colors: string[];
    color_identity: string[];
    type_line: string;
    oracle_text: string;

    image_uris: IScryfallCardImages;

    artist: string;
}

interface IScryfallCardImages {
    art_crop: string;
    border_crop: string;
    large: string;
    normal: string;
    png: string;
    small: string;
}

interface IScryfallCard {
    object: 'card';

    id: string;
    name: string;
    mana_cost: string;
    cmc: string;
    power: string;
    toughness: string;
    keywords: string[];

    price: string | null;
    prices: {
        usd: string | null;
        usd_foil: string | null;
        usd_etched: string | null;
        eur: string | null;
        eur_foil: string | null;
        tix: string | null;
    };

    colors: string[];
    color_identity: string[];
    type_line: string;
    oracle_text: string;

    image_status: 'lowres' | 'highres_scan' | string;
    image_uris: IScryfallCardImages;
    card_faces: IScryfallCardFace[];

    artist: string;
}

export type {
    IScryfallCardResult,
    IScryfallError,
    IScryfallCard,
    IScryfallCardFace,
    IScryfallCardImages,
};
