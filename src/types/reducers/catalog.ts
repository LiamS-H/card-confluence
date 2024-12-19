import { IScryfallCatalog } from '../interfaces/scryfall/catalog';
import {
    IAutocompleteMap,
    IAutocompleteNode,
    IFastAutocompleteMap,
    IMultiMap,
} from '../interfaces/search/autcomplete';
import { genFastAutocomplete } from './autocomplete';

function integerList(start: number, end: number): string[] {
    const out: string[] = [];
    for (let i = start; i <= end; i++) {
        out.push(i.toString());
    }
    return out;
}

function catalogToAutocomplete(catalog: IScryfallCatalog): IAutocompleteMap {
    const card_types = [
        ...catalog['card-types'],
        ...catalog['spell-types'],
        ...catalog['land-types'],
        ...catalog['artifact-types'],
        ...catalog['creature-types'],
        ...catalog['enchantment-types'],
        ...catalog['planeswalker-types'],
        ...catalog['supertypes'],
    ].map((type) => type.toLowerCase());
    const criteria = [...catalog['criteria']].map((set) => set.toLowerCase());
    const card_sets = [...catalog.sets].map((set) => set.toLowerCase());
    const word_bank = [...catalog['word-bank'].map((word) => word.toLowerCase())];
    const long_rarities = ['common', 'uncommon', 'rare', 'mythic'];
    const rarities = ['c', 'u', 'r', 'm', ...long_rarities];
    const cubes = [
        'arena',
        'grixis',
        'legacy',
        'chuck',
        'twisted',
        'protour',
        'uncommon',
        'april',
        'modern',
        'amaz',
        'tinkerer',
        'livethedream',
        'chromatic',
        'vintage',
    ];
    const formats = [
        'historic',
        'timeless',
        'gladiator',
        'pioneer',
        'explorer',
        'modern',
        'legacy',
        'pauper',
        'vintage',
        'penny', // Penny Dreadful
        'commander',
        'oathbreaker',
        'standardbrawl',
        'brawl',
        'alchemy',
        'paupercommander',
        'duel', // Duel Commander
        'oldschool', // Old School 93/94
        'premodern',
        'predh',
    ];
    const currencies = ['usd', 'eur', 'tix'];
    const new_wordbank = ['art', 'artist', 'flavor', 'rarity'];
    const products = [
        'core',
        'expansion',
        'draftinnovation',
        'masters',
        'funny',
        'commander',
        'duel_deck',
        'from_the_vault',
        'spellbook',
        'premium_deck',
        'alchemy',
        'archenemy',
        'masterpiece',
        'memorabilia',
        'planechase',
        'promo',
        'starter',
        'token',
        'treasure_chest',
        'vanguard',
    ];
    const borders = ['black', 'white', 'silver', 'borderless'];
    const frames = [
        '1993',
        '1997',
        '2003',
        '2015',
        'future',
        'legendary',
        'colorshifted',
        'tombstone',
        'enchantment',
    ];
    const stamps = ['oval', 'acorn', 'triangle', 'arena'];
    const games = ['paper', 'mtgo', 'mtga'];

    const year_node: IMultiMap<IAutocompleteNode> = {
        keys: integerList(1993, 2025),
        node: {
            prefix: '-',
            terminating: true,
            multimaps: [
                {
                    keys: integerList(1, 12),
                    node: {
                        prefix: '-',
                        terminating: true,
                        wordbank: integerList(1, 31),
                    },
                },
            ],
        },
    };

    const manaMap: IAutocompleteNode = {
        repeating: true,
        prefix: '{',
        suffix: '}',
        singlemap: {
            w: {
                terminating: true,
                prefix: '/',
                singlemap: {
                    u: ['/p', null],
                    b: ['/p', null],
                    p: null,
                },
            },
            u: {
                terminating: true,
                prefix: '/',
                singlemap: {
                    b: ['/p', null],
                    r: ['/p', null],
                    p: null,
                },
            },
            b: {
                terminating: true,
                prefix: '/',
                singlemap: {
                    r: ['/p', null],
                    g: ['/p', null],
                    p: null,
                },
            },
            r: {
                terminating: true,
                prefix: '/',
                singlemap: {
                    w: ['/p', null],
                    g: ['/p', null],
                    p: null,
                },
            },
            g: {
                terminating: true,
                prefix: '/',
                singlemap: {
                    w: ['/p', null],
                    u: ['/p', null],
                    p: null,
                },
            },
            c: null,
            '2': {
                terminating: true,
                singlemap: {
                    '/': ['w', 'u', 'b', 'r', 'g'],
                },
            },
            '1': null,
            '3': null,
            '4': null,
            '5': null,
            '6': null,
            '7': null,
            '8': null,
            '9': null,
            '10': null,
            '11': null,
            '12': null,
            '13': null,
            '14': null,
            '15': null,
        },
    };
    const oracle_word_bank = [
        ...catalog['ability-words'],
        ...catalog['keyword-abilities'],
        ...catalog['keyword-actions'],
        ...catalog['card-types'],
        'draw',
        'card',
        'spell',
        'search',
        'library',
        'opponent',
        "opponent's",
        'oppponents',
        'graveyard',
        'hand',
        'power',
        'toughness',
        'token',
        '~',
    ]
        .map((word) => word.toLowerCase())
        .sort();
    const FilterAutocompleteMap: IAutocompleteMap = {
        multimaps: [
            {
                keys: ['o', 'oracle', 'fo', 'fulloracle'],
                node: {
                    singlemap: {
                        ':': {
                            repeating: true,
                            wordbank: oracle_word_bank,
                            suffix: ' ',
                            freesolo: true,
                        },
                    },
                },
            },
            {
                keys: ['t', 'type'],
                node: {
                    prefix: ':',
                    wordbank: card_types,
                },
            },
            {
                keys: ['s', 'set', 'e', 'edition'],
                node: {
                    prefix: ':',
                    wordbank: card_sets,
                },
            },
            {
                keys: ['is', 'not'],
                node: {
                    prefix: ':',
                    wordbank: criteria,
                },
            },
            {
                keys: ['pow', 'power'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>', '!='],
                            node: [...catalog.powers, 'toughness', 'tou'],
                        },
                    ],
                },
            },
            {
                keys: ['tou', 'toughness'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>', '!='],
                            node: [...catalog.toughnesses, 'power', 'pow'],
                        },
                    ],
                },
            },
            {
                keys: ['pt', 'powtou'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: {
                                wordbank: integerList(0, 16),
                            },
                        },
                    ],
                },
            },
            {
                keys: ['loy', 'loyalty'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>', '!='],
                            node: catalog['loyalties'],
                        },
                    ],
                },
            },
            {
                keys: ['m', 'mana', 'produces', 'devotion'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>', '!='],
                            node: manaMap,
                        },
                    ],
                },
            },
            {
                keys: ['name'],
                node: {
                    prefix: ':',
                    wordbank: word_bank,
                },
            },
            {
                keys: ['c', 'color', 'id', 'commander'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: {
                                terminating: true,
                                repeating: true,
                                forceUniqueRepeats: true,
                                wordbank: ['w', 'u', 'b', 'r', 'g', 'c'],
                            },
                        },
                    ],
                },
            },
            {
                keys: ['kw', 'keyword'],
                node: {
                    prefix: ':',
                    wordbank: [...catalog['keyword-abilities'], ...catalog['keyword-actions']],
                },
            },
            {
                keys: ['mv', 'cmc'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: {
                                wordbank: integerList(0, 30),
                            },
                        },
                    ],
                },
            },
            {
                keys: ['r', 'rarity'],
                node: {
                    prefix: ':',
                    wordbank: rarities,
                },
            },
            {
                keys: ['in'],
                node: {
                    prefix: ':',
                    wordbank: [...catalog['sets'], ...long_rarities],
                },
            },
            {
                keys: ['cube'],
                node: {
                    prefix: ':',
                    wordbank: cubes,
                },
            },
            {
                keys: ['f', 'format'],
                node: {
                    prefix: ':',
                    wordbank: formats,
                },
            },
            {
                keys: currencies,
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: null,
                        },
                    ],
                },
            },
            {
                keys: ['cheapest'],
                node: {
                    prefix: ':',
                    wordbank: currencies,
                },
            },
            {
                keys: ['a', 'artist'],
                node: {
                    prefix: ':',
                    wordbank: catalog['artist-names'],
                },
            },
            {
                keys: ['artists'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: integerList(1, 2),
                        },
                    ],
                },
            },
            {
                keys: ['illustrations', 'sets', 'papersets', 'print', 'paperprints'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: integerList(1, 20),
                        },
                    ],
                },
            },
            {
                keys: ['ft', 'flavor'],
                node: {
                    prefix: ':',
                },
            },
            {
                keys: ['wm', 'watermark'],
                node: {
                    prefix: ':',
                    wordbank: catalog['watermarks'],
                },
            },
            {
                keys: ['new'],
                node: {
                    prefix: ':',
                    wordbank: new_wordbank,
                },
            },
            {
                keys: ['st'],
                node: {
                    prefix: ':',
                    wordbank: products,
                },
            },
            {
                keys: ['border'],
                node: {
                    prefix: ':',
                    wordbank: borders,
                },
            },
            {
                keys: ['frame'],
                node: {
                    prefix: ':',
                    wordbank: frames,
                },
            },
            {
                keys: ['stamp'],
                node: {
                    prefix: ':',
                    wordbank: stamps,
                },
            },
            {
                keys: ['date'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: {
                                multimaps: [
                                    year_node,
                                    {
                                        keys: catalog['sets'],
                                        node: null,
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
            {
                keys: ['year'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>', '!='],
                            node: {
                                multimaps: [year_node],
                            },
                        },
                    ],
                },
            },
            {
                keys: ['art', 'atag', 'arttag'],
                node: { prefix: ':', wordbank: catalog['atags'] },
            },
            {
                keys: ['function', 'otag', 'oracletag'],
                node: { prefix: ':', wordbank: catalog['otags'] },
            },
            {
                keys: ['game'],
                node: { prefix: ':', wordbank: games },
            },
        ],
    };

    return FilterAutocompleteMap;
}

function catalogToFastAutocomplete(catalog: IScryfallCatalog): IFastAutocompleteMap {
    return genFastAutocomplete(catalogToAutocomplete(catalog));
}

export { catalogToAutocomplete, catalogToFastAutocomplete };
