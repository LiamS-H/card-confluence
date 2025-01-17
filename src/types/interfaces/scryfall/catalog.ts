interface IScryfallCatalog {
    'artist-names': string[];
    'creature-types': string[];
    'planeswalker-types': string[];
    'land-types': string[];
    'artifact-types': string[];
    'enchantment-types': string[];
    'spell-types': string[];
    powers: string[];
    toughnesses: string[];
    loyalties: string[];
    watermarks: string[];
    'keyword-abilities': string[];
    'keyword-actions': string[];
    'ability-words': string[];
    supertypes: string[];
    'word-bank': string[];
    'card-types': string[];
    criteria: string[];
    'mana-costs': string[];
    otags: string[];
    atags: string[];
    sets: string[];
    [key: string]: string[];
}

export type { IScryfallCatalog };
