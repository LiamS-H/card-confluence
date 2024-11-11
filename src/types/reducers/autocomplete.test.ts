import { describe, it, expect } from 'vitest';
import { genEsp, genFastAutocomplete } from './autocomplete';
import { IAutocompleteMap, IFastAutocompleteMap } from '../interfaces/search/autcomplete';

const fastManaMap: IFastAutocompleteMap = {
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

        expect(genFastAutocomplete(manaMap)).toEqual(fastManaMap);
    });
});

describe('autocomplete', () => {
    it('can resolve {', () => {
        expect(genEsp(fastManaMap, '{', [])).toEqual(
            new Set([
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
            ]),
        );
    });
    it('can resolve {r', () => {
        expect(genEsp(fastManaMap, '{r', [])).toEqual(new Set(['/', '}']));
    });
    it('can resolve {1', () => {
        expect(genEsp(fastManaMap, '{1', [])).toEqual(
            new Set(['10', '11', '12', '13', '14', '15', '}']),
        );
    });
    it('can resolve {1}', () => {
        expect(genEsp(fastManaMap, '{1}', [])).toEqual(new Set(['{', null]));
    });
    it('can resolve {2/', () => {
        expect(genEsp(fastManaMap, '{2/', [])).toEqual(new Set(['w', 'u', 'b', 'r', 'g']));
    });
});
