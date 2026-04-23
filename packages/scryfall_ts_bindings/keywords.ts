// prettier-ignore
export const ARGUMENTS = [ // (to keep this list somewhat organized)
    'oracle', 'o', 'fo', 'fulloracle',
    'type', 't',
    'set', 's', 'st', 'e', 'edition', 'in',
    'is', 'not',
    'power', 'pow',
    'toughness', 'tou',
    'powtou', 'pt', 
    'loyalty', 'loy',
    'mana', 'm', 'produces', 'devotion',
    'name',
    'color', 'c', 'id', 'commander',
    'keyword', 'kw',
    'cmc', 'mv', 
    'rarity', 'r', 
    'cube',
    'format', 'f', 'legal', 'banned', 'restricted',
    'artist', 'a', 
    'artists', 'illustrations', 'paperprints', 'prints', 'sets',
    'flavor', 'ft', 
    'watermark', 'wm', 
    'border',
    'frame',
    'stamp',
    'date', 'year',
    'atag', 'arttag', 'art', 
    'otag', 'oracletag', 'function', 
    'game',
    'scryfallid','oracleid',
    'cah',
    "unique",
    "order",
    "dir", "direction",
    "l", "lang","language"
] as const;

export type Argument = (typeof ARGUMENTS)[number];

export type ARG_TYPE =
    | "oracle"
    | "type"
    | "set"
    | "product"
    | "is"
    | "power"
    | "toughness"
    | "powtou"
    | "loyalty"
    | "mana"
    | "name"
    | "color"
    | "keyword"
    | "cmc"
    | "rarity"
    | "cube"
    | "format"
    | "artist"
    | "number"
    | "flavor"
    | "watermark"
    | "border"
    | "frame"
    | "stamp"
    | "date"
    | "atag"
    | "otag"
    | "game"
    | "uuid"
    | "unique"
    | "order"
    | "dir"
    | "lang";

export const ARG_TYPE_MAP: Record<Argument, ARG_TYPE> = {
    o: "oracle",
    oracle: "oracle",
    fo: "oracle",
    fulloracle: "oracle",
    t: "type",
    type: "type",
    s: "set",
    st: "product",
    set: "set",
    e: "set",
    edition: "set",
    in: "set",
    is: "is",
    not: "is",
    pow: "power",
    power: "power",
    tou: "toughness",
    toughness: "toughness",
    pt: "powtou",
    powtou: "powtou",
    loy: "loyalty",
    loyalty: "loyalty",
    m: "mana",
    mana: "mana",
    produces: "mana",
    devotion: "mana",
    name: "name",
    c: "color",
    color: "color",
    id: "color",
    commander: "color",
    kw: "keyword",
    keyword: "keyword",
    mv: "cmc",
    cmc: "cmc",
    r: "rarity",
    rarity: "rarity",
    cube: "cube",
    f: "format",
    format: "format",
    legal: "format",
    banned: "format",
    restricted: "format",
    a: "artist",
    artist: "artist",
    artists: "number",
    illustrations: "number",
    paperprints: "number",
    prints: "number",
    sets: "number",
    cah: "number",
    ft: "flavor",
    flavor: "flavor",
    wm: "watermark",
    watermark: "watermark",
    border: "border",
    frame: "frame",
    stamp: "stamp",
    date: "date",
    year: "number",
    art: "atag",
    atag: "atag",
    arttag: "atag",
    function: "otag",
    otag: "otag",
    oracletag: "otag",
    game: "game",
    oracleid: "uuid",
    scryfallid: "uuid",
    dir: "dir",
    direction: "dir",
    order: "order",
    unique: "unique",
    l: "lang",
    lang: "lang",
    language: "lang",
};

export type OPERATOR_TYPE = "assign" | "assert" | "all";

export interface ICompletionNode {
    operator: OPERATOR_TYPE;
    setting?: "order" | "dir" | "unique";
    // arg_type: ARG_TYPE;
}

export interface ICompletionMap {
    nodes: Record<ARG_TYPE, ICompletionNode>;
}

export const COMPLETION_MAP: ICompletionMap = {
    nodes: {
        oracle: { operator: "assert" },
        type: { operator: "assert" },
        set: { operator: "assert" },
        product: { operator: "assert" },
        is: {
            operator: "assert",
        },
        power: { operator: "all" },
        toughness: { operator: "all" },
        powtou: { operator: "all" },
        loyalty: { operator: "all" },
        mana: { operator: "all" },
        name: { operator: "assert" },
        color: {
            operator: "all",
        },
        keyword: { operator: "assert" },
        cmc: { operator: "all" },
        rarity: { operator: "assert" },
        cube: { operator: "assert" },
        format: { operator: "assert" },
        artist: { operator: "assert" },
        number: { operator: "all" },
        flavor: { operator: "assert" },
        watermark: {
            operator: "assert",
        },
        border: { operator: "assert" },
        frame: { operator: "assert" },
        stamp: { operator: "assert" },
        date: { operator: "all" },
        atag: { operator: "assert" },
        otag: { operator: "assert" },
        game: { operator: "assert" },
        uuid: { operator: "assert" },
        order: { operator: "assign", setting: "order" },
        dir: { operator: "assign", setting: "dir" },
        unique: { operator: "assign", setting: "unique" },
        lang: { operator: "assert" },
    },
};

export interface IDetailNode {
    detail: string;
    info: string;
}

const o_Node: IDetailNode = {
    detail: "Oracle text.",
    info: `Use the o: or oracle: keywords to find cards that have specific phrases in their text box.

You can put quotes " " around text with punctuation or spaces.

You can use ~ in your text as a placeholder for the card’s name.

This keyword usually checks the current Oracle text for cards, so it uses the most up-to-date phrasing available. For example, “dies” instead of “is put into a graveyard”.`,
};

const fo_Node: IDetailNode = {
    detail: "Full oracle text.",
    info: `${o_Node.info}

Use the fo: or fulloracle: operator to search the full Oracle text, which includes reminder text.`,
};

const type_Node: IDetailNode = {
    detail: "Card type, subtype or supertype.",
    info: `Find cards of a certain card type with the 't:' or 'type:' keywords. You can search for any supertype, card type, or subtype.`,
};
const set_Node: IDetailNode = { detail: "Set code or set name.", info: "" };
const pow_Node: IDetailNode = {
    detail: "Creature power.",
    info: `You can use numeric expressions (>, <, =, >=, <=, and !=) to find cards with certain power.
You can compare the values with 'tou'/'toughness'/'powtou' or with a provided number.`,
};
const tou_Node: IDetailNode = {
    detail: "Creature toughness.",
    info: `You can use numeric expressions (>, <, =, >=, <=, and !=) to find cards with certain toughness.
You can compare the values with 'pow'/'power'/'powtou' or with a provided number.`,
};
const powtou_Node: IDetailNode = {
    detail: "Total creature power + toughness.",
    info: `You can use numeric expressions (>, <, =, >=, <=, and !=) to find cards with certain total power and toughness.
You can compare the values with 'pow'/'power'/'tou'/'toughness' or with a provided number.`,
};

const loy_Node: IDetailNode = {
    detail: "Planeswalker loyalty.",
    info: "You can use numeric expressions (>, <, =, >=, <=, and !=) to find cards with certain stating loyalty.",
};

const kw_Node: IDetailNode = {
    detail: "Card Keywords.",
    info: `You use keyword: or kw: to search for cards with a specific keyword ability.`,
};

const m_Node: IDetailNode = {
    detail: "Mana symbols in casting costs.",
    info: `Use the m: or mana: keyword to search for cards that have certain symbols in their mana costs.

This keyword uses the official text version of mana costs set forth in the Comprehensive Rules. For example, {G} represents a green mana.

Shorthand is allowed for symbols that aren’t split: G is the same as {G}

However, you must always wrap complex/split symbols like {2/G} in braces.

You can search for mana costs using comparison operators; a mana cost is greater than another if it includes all the same symbols and more, and it’s less if it includes only a subset of symbols.`,
};

const c_Node: IDetailNode = {
    detail: "Card color.",
    info: `You can find cards that are a certain color using the c: or color: keyword

Accepts full color names like blue, nicknames like bant or quandrix, or the abbreviated color letters w, u, r, b and g.

'c:rg' Cards that are red and green

You can use comparison expressions (>, <, >=, <=, and !=) to check against ranges of colors.

'color>=uw -c:red': Cards that are at least white and blue, but not red`,
};

const id_Node: IDetailNode = {
    detail: "Colors in commander identity.",
    info: `You can find cards that are a certain commander color identity using the id: or identity: keywords.

Accepts full color names like blue, nicknames like bant or quandrix, or the abbreviated color letters w, u, r, b and g.

You can use comparison expressions (>, <, >=, <=, and !=) to check against ranges of colors.`,
};

const cmc_Node: IDetailNode = {
    detail: "Converted Mana Cost.",
    info: "",
};

const r_Node: IDetailNode = {
    detail: "Card rarity.",
    info: `Use r: or rarity: to find cards by their print rarity. You can search for common, uncommon, rare, special, mythic, and bonus. You can also use comparison operators like < and >=.`,
};

const ft_Node: IDetailNode = {
    detail: "Flavor text.",
    info: "Search for words in a card’s flavor text using the ft: or flavor: keywords.",
};

const a_Node: IDetailNode = {
    detail: "Art by a given artist.",
    info: "Search for cards illustrated by a certain artist with the a:, or artist: keywords",
};

const f_Node: IDetailNode = {
    detail: "Legal in a given format.",
    info: "The current supported formats are: standard, future (Future Standard), historic, timeless, gladiator, pioneer, explorer, modern, legacy, pauper, vintage, penny (Penny Dreadful), commander, oathbreaker, standardbrawl, brawl, alchemy, paupercommander, duel (Duel Commander), oldschool (Old School 93/94), premodern, and predh.",
};

const wm_Node: IDetailNode = {
    detail: "Card Watermark",
    info: "Search for a card’s affiliation watermark using the wm: or watermark: keywords, or match all cards with watermarks using has:watermark.",
};

const atag_Node: IDetailNode = { detail: "Community art tags.", info: "" };
const otag_Node: IDetailNode = { detail: "Community function tags.", info: "" };

const direction_Node: IDetailNode = {
    detail: "Sort direction",
    info: "Compatible with asc (ascending) or desc (descending). Note cards are sorted alphabetically by default",
};

const lang_Node: IDetailNode = {
    detail: "Card Language",
    info: "Filter the language the card was printed in.",
};

export const DETAIL_MAP: Record<Argument, IDetailNode> = {
    o: o_Node,
    oracle: o_Node,
    fo: fo_Node,
    fulloracle: fo_Node,
    t: type_Node,
    type: type_Node,
    s: set_Node,
    st: {
        detail: "Product appearance.",
        info: `You can search for cards based on the type of product they appear in. This includes the primary product types (st:core, st:expansion, or st:draftinnovation), as well as series of products (st:masters, st:funny, st:commander, st:duel_deck, st:from_the_vault, st:spellbook, or st:premium_deck) and more specialized types (st:alchemy, st:archenemy, st:masterpiece, st:memorabilia, st:planechase, st:promo, st:starter, st:token, st:treasure_chest, or st:vanguard.)`,
    },
    set: set_Node,
    sets: {
        detail: "Number of sets appeared.",
        info: "You can compare the number of sets a card has been in with 'sets=1'.",
    },
    e: set_Node,
    edition: set_Node,
    in: {
        detail: "Printed in set/rarity/game.",
        info: `The in: keyword finds cards that once “passed through” the given set code, or printing detail.

'in:rare' : cards once printed at rare

'in:arena' : cards available on arena 

'in:lea' : cards that once appeared in Alpha.`,
    },
    is: {
        detail: "Attributes for card cycles and types.",
        info: `The search system includes a few convenience shortcuts for common card sets:
is:commander, is:fetchland, is:universesbeyond, is:judge_gift`,
    },
    not: {
        detail: "Excluding attributes for card cycles and types.",
        info: "not: is equivalent to -is:",
    },
    pow: pow_Node,
    power: pow_Node,
    tou: tou_Node,
    toughness: tou_Node,
    pt: powtou_Node,
    powtou: powtou_Node,
    loy: loy_Node,
    loyalty: loy_Node,
    m: m_Node,
    mana: m_Node,
    produces: {
        detail: "Mana symbols card produces.",
        info: `You can find cards that produce specific types of mana, 'with produces:'

'produces=wu' : Cards that produce blue and white mana

See m: for instruction on mana symbol formatting.`,
    },
    devotion: {
        detail: "Colored mana symbols in casting costs.",
        info: `You can find permanents that provide specific levels of devotion, using either single-color mana symbols for devotion to one color, or hybrid symbols for devotion to two, with devotion: or a comparison operator.'

'devotion:{u/b}{u/b}{u/b}': Cards that contribute 3 to devotion to black and blue

See m: for instruction on mana symbol formatting.`,
    },
    name: { detail: "Card name.", info: "You can use RegExp." },
    c: c_Node,
    color: c_Node,
    id: id_Node,
    commander: id_Node,
    kw: kw_Node,
    keyword: kw_Node,
    mv: cmc_Node,
    cmc: cmc_Node,
    r: r_Node,
    rarity: r_Node,
    cube: {
        detail: "Occurs in a given cube.",
        info: "Find cards that are part of cube lists using the cube: keyword. The currently supported cubes are arena, grixis, legacy, chuck, twisted, protour, uncommon, april, modern, amaz, tinkerer, livethedream, chromatic, vintage, apcube.",
    },
    f: f_Node,
    format: f_Node,
    legal: f_Node,
    banned: {
        detail: "Banned in a given format.",
        info: "You can also find cards that are explicitly banned in a format with the banned: keyword and restricted with the restricted: keyword.",
    },
    restricted: {
        detail: "Restricted in a given format.",
        info: "You can also find cards that are explicitly restricted in a format with the restricted: keyword and banned with the banned: keyword.",
    },
    a: a_Node,
    artist: a_Node,
    artists: {
        detail: "Number of artists.",
        info: "you can search for cards with more than one artist using 'artists>1'.",
    },
    illustrations: {
        detail: "Number of illustrations.",
        info: "You can compare how many different illustrations a give card has with things like 'illustrations>1'.",
    },
    paperprints: {
        detail: "Times printed in paper.",
        info: `You can compare the number of times a card has been printed in paper

'e:arn papersets=1' : Cards that were printed in Arabian Nights but never reprinted in paper`,
    },
    prints: {
        detail: "Times printed.",
        info: "Number of total printings (online and paper). see 'paperprints:' for paper only.",
    },
    ft: ft_Node,
    flavor: ft_Node,
    wm: wm_Node,
    watermark: wm_Node,
    border: {
        detail: "Card border.",
        info: "Use the border: keyword to find cards with a black, white, silver, or borderless border.",
    },
    frame: {
        detail: "Card frame.",
        info: "You can find cards with a specific frame edition using frame:1993, frame:1997, frame:2003, frame:2015, and frame:future. You can also search for particular frame-effects, such as frame:legendary, frame:colorshifted, frame:tombstone, frame:enchantment.",
    },
    stamp: {
        detail: "Card stamp.",
        info: "Search for a card’s security stamp with stamp:oval, stamp:acorn, stamp:triangle, or stamp:arena.",
    },
    date: {
        detail: "Date printed.",
        info: "You can use numeric expressions (>, <, =, >=, <=, and !=) to find cards that were released relative to a certain year or a yyyy-mm-dd date. You can also use any set code to stand in for the set’s release date.",
    },
    year: {
        detail: "Year printed.",
        info: "Accepts a number such as 1999.",
    },
    art: atag_Node,
    atag: atag_Node,
    arttag: atag_Node,
    function: otag_Node,
    otag: otag_Node,
    oracletag: otag_Node,
    game: {
        detail: "Playable in a given game.",
        info: `'MTGO', 'MTGA'/'arena', or 'paper'`,
    },
    scryfallid: {
        detail: "UUID unique to printing",
        info: "A UUID v4 generated by scryfall to match a specific printing of card.",
    },
    oracleid: {
        detail: "UUID unique to card not printing",
        info: "A UUID v4 generated by gatherer to represent all functionally identical cards, useful for finding all printings of cards.",
    },
    cah: {
        detail: "Canadian Highlander Points",
        info: "Search for cards on the points list using cah>=1.",
    },
    dir: direction_Node,
    direction: direction_Node,
    order: {
        detail: "Sorting method",
        info: `The order parameter determines how Scryfall should sort the returned cards.\n\nDefault alphabetical by name.`,
    },
    unique: {
        detail: "Duplicate handling",
        info: `The unique parameter specifies if Scryfall should remove “duplicate” results in your query.\n\nDefault duplicates are hidden.`,
    },
    l: lang_Node,
    lang: lang_Node,
    language: lang_Node,
};
