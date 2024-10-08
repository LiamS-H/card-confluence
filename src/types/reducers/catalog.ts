import { IScryfallCatalog } from '../interfaces/scryfall/catalog';
import {
    IAutocompleteMap,
    IAutocompleteNode,
    IFastAutocompleteMap,
} from '../interfaces/search/autcomplete';
import { genFastAutocomplete } from './autocomplete';

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
    const word_bank = catalog['word-bank'];
    const powers = catalog.powers;
    const toughnesses = catalog.toughnesses;
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
        '',
    ]
        .map((word) => word.toLowerCase())
        .sort();
    const FilterAutocompleteMap: IAutocompleteMap = {
        multimaps: [
            {
                keys: ['o', 'oracle'],
                node: {
                    singlemap: {
                        ':': {
                            repeating: true,
                            wordbank: oracle_word_bank,

                            suffix: ' ',
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
                keys: ['s', 'set'],
                node: {
                    prefix: ':',
                    wordbank: card_sets,
                },
            },
            {
                keys: ['is'],
                node: {
                    prefix: ':',
                    wordbank: criteria,
                },
            },
            {
                keys: ['p', 'power'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>'],
                            node: powers,
                        },
                    ],
                },
            },
            {
                keys: ['toughness'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>'],
                            node: toughnesses,
                        },
                    ],
                },
            },
            {
                keys: ['m', 'mana'],
                node: {
                    multimaps: [
                        {
                            keys: ['=', '<=', '>=', '<', '>'],
                            node: manaMap,
                        },
                    ],
                },
            },
            {
                keys: ['n', 'name'],
                node: {
                    prefix: ':',
                    wordbank: word_bank,
                },
            },
            {
                keys: ['c', 'color'],
                node: {
                    multimaps: [
                        {
                            keys: [':', '=', '<=', '>=', '<', '>'],
                            node: {
                                repeating: true,
                                forceUniqueRepeats: true,
                                wordbank: ['w', 'u', 'b', 'r', 'g', 'c'],
                            },
                        },
                    ],
                },
            },
            {
                keys: ['commander'],
                node: {
                    singlemap: {
                        ':': {
                            repeating: true,
                            forceUniqueRepeats: true,
                            wordbank: ['w', 'u', 'b', 'r', 'g', 'c'],
                        },
                    },
                },
            },
        ],
    };

    return FilterAutocompleteMap;
}

function catalogToFastAutocomplete(catalog: IScryfallCatalog): IFastAutocompleteMap {
    return genFastAutocomplete(catalogToAutocomplete(catalog));
}

export { catalogToAutocomplete, catalogToFastAutocomplete };
