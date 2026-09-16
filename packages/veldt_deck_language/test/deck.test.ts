import { describe, test, expect } from 'bun:test';

import { veldtDeck, parseVeldtDeck, addTag, addView, DeckObject } from '../src/index.ts';
import { EditorState } from '@codemirror/state';

describe('veldt Deck Extraction', () => {
	test('isolated domain', () => {
		const doc = `
domain [ legal:commander ]
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { domain } = parseVeldtDeck(state);
		expect(domain).toBe('legal:commander');
	});

	test('combined domain', () => {
		const doc = `
domain [ legal:commander ]
domain [ id:wu ]
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { domain } = parseVeldtDeck(state);
		expect(domain).toBe('legal:commander id:wu');
	});

	test('simple tag', () => {
		const doc = `
tag test [ legal:commander ]
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			test: { object: 'tag', label: 'test', query: 'legal:commander', scope: '' }
		});
	});

	test('simple scoped tag', () => {
		const doc = `
group test {tag inline [o:test]}
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			'test:inline': { object: 'tag', label: 'inline', query: 'o:test', scope: 'test' },
			test: { object: 'group', label: 'test', children: ['test:inline'], scope: '' }
		});
	});

	test('simple tag + view', () => {
		const doc = `
tag tag1 [t:tag]
view test {tag1}
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			tag1: { object: 'tag', label: 'tag1', query: 't:tag', scope: '' },
			test: { object: 'view', label: 'test', children: ['tag1'] }
		});
	});

	test('closure: ident masking', () => {
		const doc = `
tag masked [t:0]
view test {
    tag masked [t:1],
    group test {
        masked
    }
}
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			masked: { object: 'tag', label: 'masked', query: 't:0', scope: '' },
			'test:masked': { object: 'tag', label: 'masked', query: 't:1', scope: 'test' },
			'test:test': { object: 'group', label: 'test', children: ['test:masked'], scope: 'test' },
			test: { object: 'view', label: 'test', children: ['test:masked', 'test:test'] }
		});
	});

	test('nested groups', () => {
		const doc = `
tag child0 [t:0]
tag child1 [t:1]
tag child2 [t:2]
tag child3 [t:3]

group parent0 {child0,child1}
group parent1 {child2,child3}

view test {
    group parent2 {parent0,parent1}
}
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			child0: { object: 'tag', label: 'child0', query: 't:0', scope: '' },
			child1: { object: 'tag', label: 'child1', query: 't:1', scope: '' },
			child2: { object: 'tag', label: 'child2', query: 't:2', scope: '' },
			child3: { object: 'tag', label: 'child3', query: 't:3', scope: '' },
			parent0: { object: 'group', label: 'parent0', children: ['child0', 'child1'], scope: '' },
			parent1: { object: 'group', label: 'parent1', children: ['child2', 'child3'], scope: '' },
			'test:parent2': {
				object: 'group',
				label: 'parent2',
				children: ['parent0', 'parent1'],
				scope: 'test'
			},
			test: { object: 'view', label: 'test', children: ['test:parent2'] }
		});
	});
	test('nested groups mixed', () => {
		const doc = `

tag child2 [t:2]
group parent0 {child0,child1}
tag child1 [t:1]
view test {
    group parent2 {parent0,parent1}
}
group parent1 {child2,child3}
tag child0 [t:0]
tag child3 [t:3]
`;
		const state = EditorState.create({
			doc,
			extensions: [veldtDeck()]
		});
		const { objects } = parseVeldtDeck(state);
		const asObject: Record<string, DeckObject> = Object.fromEntries(objects);
		expect(asObject).toEqual({
			child0: { object: 'tag', label: 'child0', query: 't:0', scope: '' },
			child1: { object: 'tag', label: 'child1', query: 't:1', scope: '' },
			child2: { object: 'tag', label: 'child2', query: 't:2', scope: '' },
			child3: { object: 'tag', label: 'child3', query: 't:3', scope: '' },
			parent0: { object: 'group', label: 'parent0', children: ['child0', 'child1'], scope: '' },
			parent1: { object: 'group', label: 'parent1', children: ['child2', 'child3'], scope: '' },
			'test:parent2': {
				object: 'group',
				label: 'parent2',
				children: ['parent0', 'parent1'],
				scope: 'test'
			},
			test: { object: 'view', label: 'test', children: ['test:parent2'] }
		});
	});
});

describe('veld Deck Editting', () => {
	test('should add tags and views', () => {
		let state = EditorState.create({
			doc: '',
			extensions: [veldtDeck()]
		});

		const tagSpec = addTag(state, 'newtag', 'o:scry');
		state = state.update(tagSpec).state;

		const viewSpec = addView(state, 'newview');
		state = state.update(viewSpec).state;

		const {} = parseVeldtDeck(state);
	});
});
