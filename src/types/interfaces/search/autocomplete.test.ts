import { describe, it, expect } from 'vitest';
import { catalogToAutocomplete } from '../../reducers/catalog';
import { useScryfallFilterMap } from '../../../hooks/scryfall/catalog';
import { genFastAutocomplete } from '../../reducers/autocomplete';
import { IAutocompleteMap, IFastAutocompleteMap } from './autcomplete';
import { noop } from 'vitest/utils.js';

describe('slow to fast autocomplete', () => {
    it('converts mana map', () => {
        const manaMap: IAutocompleteMap = {
            repeating: true,
            prefix: '{',
            suffix: '}',
            multimaps: [
                {
                    keys: [
                        '1',
                        '3',
                        '4',
                        '5',
                        '6',
                        '7',
                        '8',
                        '9',
                        '10',
                        '11',
                        '12',
                        '13',
                        '14',
                        '15',
                    ],
                    node: null,
                },
            ],
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
            },
        };
        const fastManaMap = genFastAutocomplete(manaMap);
        const expectedFastManaMap: IFastAutocompleteMap = {
            repeating: true,
            prefix: '{',
            suffix: '}',
            sorted_options: [
                '1',
                '10',
                '11',
                '12',
                '13',
                '14',
                '15',
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9',
                'b',
                'c',
                'g',
                'r',
                'u',
                'w',
            ],
            singlemap: {
                w: {
                    sorted_options: ['b', 'p', 'u'],
                    terminating: true,
                    prefix: '/',
                    singlemap: {
                        u: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        b: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        p: null,
                    },
                },
                u: {
                    sorted_options: ['b', 'p', 'r'],
                    terminating: true,
                    prefix: '/',
                    singlemap: {
                        b: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        r: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        p: null,
                    },
                },
                b: {
                    sorted_options: ['g', 'p', 'r'],
                    terminating: true,
                    prefix: '/',
                    singlemap: {
                        r: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        g: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        p: null,
                    },
                },
                r: {
                    sorted_options: ['g', 'p', 'w'],
                    terminating: true,
                    prefix: '/',
                    singlemap: {
                        w: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        g: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        p: null,
                    },
                },
                g: {
                    sorted_options: ['p', 'u', 'w'],
                    terminating: true,
                    prefix: '/',
                    singlemap: {
                        w: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        u: {
                            terminating: true,
                            singlemap: {},
                            sorted_options: ['/p'],
                        },
                        p: null,
                    },
                },
                c: null,
                '2': {
                    sorted_options: ['/'],
                    terminating: true,
                    singlemap: {
                        '/': {
                            singlemap: {},
                            sorted_options: ['b', 'g', 'r', 'u', 'w'],
                        },
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
        expect(fastManaMap).toEqual(expectedFastManaMap);
    });
});
