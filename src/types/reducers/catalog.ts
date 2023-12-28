import { IScryfallCatalog } from '../interfaces/scryfall/catalog';
import { IAutocompleteMap } from '../interfaces/search/autcomplete';

function catalogToFilterMap(catalog: IScryfallCatalog): IAutocompleteMap {
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
    const criteria = catalog['criteria'];
    const card_sets = [...catalog.sets].map((set) => set.toLowerCase());
    const word_bank = catalog['word-bank'];
    const powers = catalog.powers;
    const toughnesses = catalog.toughnesses;
    const manaMap = {
        wordbank: {
            tree: {
                '{': {
                    tree: {
                        w: {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        u: ['/p}', '}'],
                                        b: ['/p', '}'],
                                        'p}': [],
                                    },
                                },
                            },
                        },
                        u: {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        b: ['/p', '}'],
                                        r: ['/p', '}'],
                                        'p}': [],
                                    },
                                },
                            },
                        },
                        b: {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        r: ['/p', '}'],
                                        g: ['/p', '}'],
                                        'p}': [],
                                    },
                                },
                            },
                        },
                        r: {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        w: ['/p}', '}'],
                                        g: ['/p', '}'],
                                        'p}': [],
                                    },
                                },
                            },
                        },
                        g: {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        w: ['/p}', '}'],
                                        u: ['/p', '}'],
                                        'p}': [],
                                    },
                                },
                            },
                        },
                        c: ['}'],
                        '2': {
                            tree: {
                                '}': [],
                                '/': {
                                    tree: {
                                        w: ['}'],
                                        u: ['}'],
                                        b: ['}'],
                                        r: ['}'],
                                        g: ['}'],
                                    },
                                },
                            },
                        },
                        '1': ['}'],
                        '3': ['}'],
                        '4': ['}'],
                        '5': ['}'],
                        '6': ['}'],
                        '7': ['}'],
                        '8': ['}'],
                        '9': ['}'],
                        '10': ['}'],
                        '11': ['}'],
                        '12': ['}'],
                        '13': ['}'],
                        '14': ['}'],
                        '15': ['}'],
                    },
                },
            },
        },
        freeSolo: true,
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
    ]
        .map((word) => word.toLowerCase())
        .sort();
    const FilterAutocompleteMap: IAutocompleteMap = {
        tree: {
            o: {
                tree: {
                    ':': {
                        freeSolo: true,
                        wordbank: oracle_word_bank,
                    },
                },
            },
            t: {
                tree: {
                    ':': card_types,
                },
            },
            set: {
                tree: {
                    ':': card_sets,
                },
            },
            is: {
                tree: {
                    ':': criteria,
                },
            },
            power: {
                tree: {
                    '=': powers,
                    '<=': powers,
                    '>=': powers,
                    '<': powers,
                    '>': powers,
                },
            },
            toughness: {
                tree: {
                    '=': toughnesses,
                    '<=': toughnesses,
                    '>=': toughnesses,
                    '<': toughnesses,
                    '>': toughnesses,
                },
            },
            m: {
                tree: {
                    '=': manaMap,
                    '<=': manaMap,
                    '>=': manaMap,
                    '<': manaMap,
                    '>': manaMap,
                },
            },
            name: word_bank,
        },
    };
    return FilterAutocompleteMap;
}

export { catalogToFilterMap };
