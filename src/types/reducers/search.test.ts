import { describe, it, expect } from 'vitest';
import { genSearchObj } from './search';

describe('string to filter obj', () => {
    it('works on complex string', () => {
        const str = `(game:paper legal:commander) ((o:draw -(o:"opponent draws a card"))) ()`;
        const obj = genSearchObj(str);
        const expected = {
            domain: {
                id: 'domain',
                name: 'Domain',
                type: 'composition',
                mode: 'and',
                components: [
                    {
                        type: 'filter',
                        filter: 'game',
                        operator: ':',
                        value: 'paper',
                    },
                    {
                        type: 'filter',
                        filter: 'legal',
                        operator: ':',
                        value: 'commander',
                    },
                ],
            },
            filters: {
                id: 'filters',
                name: 'Filters',
                type: 'composition',
                mode: 'and',
                components: [
                    {
                        id: '10',
                        name: 'unnamed composition',
                        type: 'composition',
                        mode: 'and',
                        components: [
                            {
                                type: 'filter',
                                filter: 'o',
                                operator: ':',
                                value: 'draw',
                            },
                            {
                                id: '101',
                                name: 'unnamed composition',
                                type: 'composition',
                                mode: 'not',
                                components: [
                                    {
                                        type: 'filter',
                                        filter: 'o',
                                        operator: ':',
                                        value: 'opponent draws a card',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            triggers: {
                id: 'triggers',
                name: 'Triggers',
                type: 'composition',
                mode: 'and',
                components: [],
            },
        };
        expect(obj).toStrictEqual(expected);
    });
    it('works base string', () => {
        const str = `(game:paper legal:commander) () ()`;
        const obj = genSearchObj(str);
        const expected = {
            domain: {
                id: 'domain',
                name: 'Domain',
                type: 'composition',
                mode: 'and',
                components: [
                    {
                        type: 'filter',
                        filter: 'game',
                        operator: ':',
                        value: 'paper',
                    },
                    {
                        type: 'filter',
                        filter: 'legal',
                        operator: ':',
                        value: 'commander',
                    },
                ],
            },
            filters: {
                id: 'filters',
                name: 'Filters',
                type: 'composition',
                mode: 'and',
                components: [],
            },
            triggers: {
                id: 'triggers',
                name: 'Triggers',
                type: 'composition',
                mode: 'and',
                components: [],
            },
        };
        expect(obj).toStrictEqual(expected);
    });
});
