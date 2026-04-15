export const SearchOrders = [
    {
        label: "name",
        detail: undefined,
        info: "Sort cards by name, A -> Z",
    },
    {
        label: "set",
        detail: "code / number",
        info: "Sort cards by their set and collector number: AAA/#1 -> ZZZ/#999",
    },
    {
        label: "released",
        detail: "date",
        info: "Sort cards by their release date: Newest -> Oldest",
    },
    {
        label: "rarity",
        detail: undefined,
        info: "Sort cards by their rarity: Common -> Mythic",
    },
    {
        label: "color",
        detail: undefined,
        info: "Sort cards by their color and color identity: WUBRG -> multicolor -> colorless",
    },
    {
        label: "usd",
        detail: "$",
        info: "Sort cards by their lowest known U.S. Dollar price: 0.01 -> highest, null last",
    },
    {
        label: "tix",
        detail: "mtgo",
        info: "Sort cards by their lowest known TIX price: 0.01 -> highest, null last",
    },
    {
        label: "eur",
        detail: "€",
        info: "Sort cards by their lowest known Euro price: 0.01 -> highest, null last",
    },
    {
        label: "cmc",
        detail: undefined,
        info: "Sort cards by their mana value: 0 -> highest",
    },
    {
        label: "power",
        detail: undefined,
        info: "Sort cards by their power: null -> highest",
    },
    {
        label: "toughness",
        detail: undefined,
        info: "Sort cards by their toughness: null -> highest",
    },
    {
        label: "edhrec",
        detail: "playrate",
        info: "Sort cards by their EDHREC ranking: lowest -> highest",
    },
    {
        label: "penny",
        detail: "playrate",
        info: "Sort cards by their Penny Dreadful ranking: lowest -> highest",
    },
    {
        label: "artist",
        detail: undefined,
        info: "Sort cards by their front-side artist name: A -> Z",
    },
    {
        label: "review",
        detail: undefined,
        info: "Sort cards how podcasts review sets, usually color & CMC, lowest -> highest, with Booster Fun cards at the end",
    },
] as const;
export const SearchUniques = [
    {
        label: "cards",
        info: "Removes duplicate gameplay objects (cards that share a name and have the same functionality). For example, if your search matches more than one print of Pacifism, only one copy of Pacifism will be returned.",
    },
    {
        label: "art",
        info: "Returns only one copy of each unique artwork for matching cards. For example, if your search matches more than one print of Pacifism, one card with each different illustration for Pacifism will be returned, but any cards that duplicate artwork already in the results will be omitted.",
    },
    {
        label: "prints",
        info: "Returns all prints for all cards matched (disables rollup). For example, if your search matches more than one print of Pacifism, all matching prints will be returned.",
    },
] as const;
export const SearchOptions = [
    "unique",
    "order",
    "dir",
    "include_extras",
    "include_multilingual",
    "include_variations",
    "page",
    "format",
    "pretty",
] as const;
export interface ISearchSettings {
    unique?: "cards" | "art" | "prints"; //The strategy for omitting similar cards.
    order?: (typeof SearchOrders)[number]["label"]; //The method to sort returned cards.
    dir?: "auto" | "asc" | "desc"; //The direction to sort cards.
    include_extras?: boolean; //If true, extra cards (tokens, planes, etc) will be included. Equivalent to adding include:extras to the fulltext search. Defaults to false.
    include_multilingual?: boolean; //If true, cards in every language supported by Scryfall will be included. Defaults to false.
    include_variations?: boolean; //If true, rare care variants will be included, like the Hairy Runesword. Defaults to false.
    page?: number; //The page number to return, default 1.
    format?: "json" | "csv"; //The data format to return: json or csv. Defaults to json.
    pretty?: boolean; //If true, the returned JSON will be prettified. Avoid using for production code.
}
