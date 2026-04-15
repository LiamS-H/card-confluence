import {
    type ScryfallList,
    type ScryfallCatalog,
    type ScryfallError,
    type ScryfallCard,
} from "@scryfall/api-types";
import {
    type ISearchSettings,
    // SearchOrders,
    // SearchUniques
} from "./search";

// WARNING: Currently NOT Parallel safe
// let LastRequest: number = null;
// const RATE_LIMIT_MS = 100;

// export async function fetchWithCooldown<
//     F extends () => Promise<T>,
//     T extends unknown,
// >(fetch_func: F): Promise<T> {
//     const now = Date.now();
//     if (LastRequest === null) {
//         return fetch_func();
//     }
//     const delta = LastRequest - now;
//     if (delta < RATE_LIMIT_MS) {
//         return fetch_func();
//     }

//     LastRequest = Date.now();
//     const promise = new Promise<T>((res) => {
//         setTimeout(() => res(fetch_func()), RATE_LIMIT_MS - delta);
//     });
//     return promise;
// }

export async function fetchWithHeaders(url: URL) {
    return fetch(url, {
        headers: {
            "User-Agent": "card-confluence/0.0",
            Accept: "*/*",
        },
    });
}

export const ScryfallBulkDataTypes = [
    "oracle_cards",
    "unique_artwork",
    "default_cards",
    "all_cards",
    "rulings",
] as const;
export interface ScryfallBulkData {
    object: "bulk_data";
    id: string;
    type: (typeof ScryfallBulkDataTypes)[number];
    updated_at: string; // ISO 8601 format
    uri: string; // link to the query to return this metadata
    name: string;
    description: string;
    size: number;
    download_uri: string; // link to download the json file
    content_type: "application/json";
    content_encoding: "gzip";
}

export async function fetchBulk(
    endpoint: (typeof ScryfallBulkDataTypes)[number],
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallBulkData | ScryfallError> {
    const url = new URL(`https://api.scryfall.com/bulk-data/${endpoint}`);
    const response = await fetch_func(url);
    const card_list: ScryfallBulkData = await response.json();
    return card_list;
}

export async function fetchMigrations(
    page?: number,
    fixed_url?: string,
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallList.Migrations | ScryfallError> {
    if (fixed_url !== undefined && fixed_url !== "" && page !== undefined) {
        throw Error("overwriting page with fixed url.");
    }
    const url = new URL(
        fixed_url ?? `https://api.scryfall.com/migrations/${page}`,
    );
    const response = await fetch_func(url);
    const card_list: ScryfallList.Migrations = await response.json();
    return card_list;
}

export async function fetchSearch(
    query: string,
    settings?: ISearchSettings,
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallList.Cards | ScryfallError> {
    const url = new URL("https://api.scryfall.com/cards/search");
    const params = { q: query };
    const search = new URLSearchParams(params);
    if (settings) {
        for (const key in settings) {
            const val = (settings as Record<string, string | boolean | number>)[
                key
            ]?.toString();
            if (!val) continue;
            search.set(key, val.toString());
        }
    }

    url.search = search.toString();
    const response = await fetch_func(url);
    const card_list: ScryfallList.Cards = await response.json();
    return card_list;
}

export async function fetchRandom(
    query: string,
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallCard.Any | ScryfallError> {
    const url = new URL("https://api.scryfall.com/cards/random");
    const params = { q: query };
    const search = new URLSearchParams(params);
    url.search = search.toString();
    const response = await fetch_func(url);
    const card: ScryfallCard.Any = await response.json();
    return card;
}

export async function fetchRulings(
    id: string,
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallList.Rulings | ScryfallError> {
    const url = new URL(`https://api.scryfall.com/cards/${id}/rulings`);
    const response = await fetch_func(url);
    const rulings: ScryfallList.Rulings | ScryfallError = await response.json();
    return rulings;
}

export const catalogEndpoints = [
    "card-names",
    "artist-names",
    "word-bank",
    "supertypes",
    "card-types",
    "artifact-types",
    "battle-types",
    "creature-types",
    "enchantment-types",
    "land-types",
    "planeswalker-types",
    "spell-types",
    "powers",
    "toughnesses",
    "loyalties",
    "keyword-abilities",
    "keyword-actions",
    "ability-words",
    "flavor-words",
    "watermarks",
] as const;
export async function fetchCatalog(
    endpoint: (typeof catalogEndpoints)[number],
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<string[]> {
    const url = new URL(`https://api.scryfall.com/catalog/${endpoint}`);
    const response = await fetch_func(url);
    const catalog: ScryfallCatalog = await response.json();
    return catalog.data;
}

export async function fetchSets(
    fetch_func: typeof fetchWithHeaders = fetchWithHeaders,
): Promise<ScryfallList.Sets | ScryfallError> {
    const url = new URL("https://api.scryfall.com/sets");
    const response = await fetch_func(url);
    const sets: ScryfallList.Sets = await response.json();
    return sets;
}

export async function fetchAllTags(): Promise<{
    atags: string[];
    otags: string[];
}> {
    const otags: string[] = [];
    const atags: string[] = [];

    const resp = await fetch("https://scryfall.com/docs/tagger-tags");
    const text = await resp.text();

    const sectionRegex = /<h2[^>]*>(.*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
    let match: RegExpExecArray | null = null;
    while ((match = sectionRegex.exec(text)) !== null) {
        const header = match[1];
        const pContent = match[2];
        if (!header || !pContent) continue;

        const tags: string[] = [];
        const linkRegex = /<a[^>]*>(.*?)<\/a>/g;
        let linkMatch: RegExpExecArray | null = null;
        while ((linkMatch = linkRegex.exec(pContent)) !== null) {
            const tag = linkMatch[1];
            if (tag) {
                tags.push(tag.trim());
            }
        }

        if (header.endsWith("(functional)")) {
            otags.push(...tags);
        } else {
            atags.push(...tags);
        }
    }

    return { otags, atags };
}

export async function fetchCardTags(
    set: string,
    collector_number: string,
): Promise<string[]> {
    try {
        const cn = collector_number.match(/^\d+/)?.[0] ?? collector_number;
        const url = `https://tagger.scryfall.com/card/${set}/${cn}`;
        const resp = await fetch(url);
        const text = await resp.text();

        const metaTagMatch = text.match(
            /<meta\s+property="og:description"\s+content="([^"]*)"/,
        );
        if (!metaTagMatch || !metaTagMatch[1]) return [];
        const content = metaTagMatch[1];

        const cardTagsMatch = content.match(
            /Card Tags:\s*([\s\S]*?)(?=\n\n|$)/,
        );
        if (!cardTagsMatch || !cardTagsMatch[1]) return [];

        const cardTagsSection = cardTagsMatch[1];

        const cardTags = cardTagsSection
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.replace(/^[★•]\s*/, ""));

        return cardTags;
    } catch {
        return [];
    }
}
