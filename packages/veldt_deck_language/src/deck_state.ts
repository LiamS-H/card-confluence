import { StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import * as Term from './parser/parser.terms';
// Term.Query ends up breaking, because it is parsed inside the child language

import { syntaxTree } from '@codemirror/language';
import type { EditorState, TransactionSpec } from '@codemirror/state';

export type DeckObject = Tag | Group | View;

export interface TagSettings {}
export interface Tag {
	object: 'tag';
	label: string;
	scope: string;
	query: string;
}

export interface GroupSettings {}
export interface Group {
	object: 'group';
	label: string;
	scope: string;
	children: string[];
}

export interface ViewSettings {
	includeall: boolean;
}
export interface View {
	object: 'view';
	label: string;
	children: string[];
}

export interface Deck {
	domain: string;
	objects: Map<string, DeckObject>;
	views: string[];
}

export const deckStateField = StateField.define<Deck>({
	create(state) {
		return parseVeldtDeck(state);
	},
	update(oldTags, transaction) {
		if (!transaction.docChanged) {
			return oldTags;
		}

		return parseVeldtDeck(transaction.state);
	}
});

export function onDeckUpdate(callback: (deck: Deck) => void) {
	return EditorView.updateListener.of((update) => {
		if (update.state.field(deckStateField) !== update.startState.field(deckStateField)) {
			const currentDeck = update.state.field(deckStateField);
			callback(currentDeck);
		}
	});
}

export interface CursorTag {
	tag: Tag;
	key: string;
	queryPos: number | null;
}

export const cursorTagStateField = StateField.define<CursorTag | null>({
	create(state) {
		const cursor_tag = tagAtCursor(state, state.selection.main.head);
		if (!cursor_tag) return null;
		const { queryPos, key } = cursor_tag;
		const deck = state.field(deckStateField);
		if (key === 'domain') {
			return {
				key,
				queryPos,
				tag: { query: deck.domain, object: 'tag', label: 'domain', scope: '' }
			};
		}
		const tag = deck.objects.get(key);
		if (!tag || tag.object !== 'tag') return null;

		return { key, queryPos, tag };
	},
	update(oldTag, transaction) {
		if (!(transaction.docChanged || transaction.selection)) {
			return oldTag;
		}
		const state = transaction.state;
		const cursor_tag = tagAtCursor(state, state.selection.main.head);
		if (!cursor_tag) return null;
		const { queryPos, key } = cursor_tag;
		const deck = state.field(deckStateField);
		if (key === 'domain') {
			return {
				key,
				queryPos,
				tag: { query: deck.domain, object: 'tag', label: 'domain', scope: '' }
			};
		}
		const tag = deck.objects.get(key);
		if (!tag || tag.object !== 'tag') return null;

		return { key, queryPos, tag };
	}
});

export function onCursorTagUpdate(callback: (deck: CursorTag | null) => void) {
	return EditorView.updateListener.of((update) => {
		if (update.state.field(cursorTagStateField) !== update.startState.field(cursorTagStateField)) {
			const currentTag = update.state.field(cursorTagStateField);
			callback(currentTag);
		}
	});
}

export function tagAtCursor(
	state: EditorState,
	pos: number
): null | {
	queryPos: number | null;
	key: string;
} {
	const tree = syntaxTree(state);
	const deck = state.field(deckStateField);

	let found: {
		queryPos: number | null;
		key: string;
	} | null = null;
	const scope: string[] = [];

	tree.iterate({
		from: pos,
		to: pos,
		enter: (node) => {
			if (found !== null) return false;
			const scope_str = scope.join(':');
			const parent: DeckObject | null = deck.objects.get(scope_str) ?? null;
			switch (node.type.id) {
				case Term.ViewDefinition:
				case Term.GroupDefinition: {
					const identifier = node.node.getChild(Term.Identifier);
					if (identifier === null) {
						return false;
					}
					const label = state.doc.sliceString(identifier.from, identifier.to);
					scope.push(label);
					return true;
				}
				case Term.DomainDefinition: {
					if (node.from > pos || pos >= node.to) {
						return true;
					}
					const queryNode = node.node.getChild('Query');
					if (!queryNode) return false;
					const position = pos - queryNode.from;
					found = {
						queryPos: position >= 0 ? position : null,
						key: 'domain'
					};
					return false;
				}
				case Term.TagDefinition: {
					if (node.from > pos || pos >= node.to) {
						return true;
					}
					const queryNode = node.node.getChild('Query');
					const ident = node.node.getChild(Term.Identifier);
					if (!queryNode || !ident) return false;
					const label = state.doc.sliceString(ident.from, ident.to);
					// const query = state.doc.sliceString(queryNode.from, queryNode.to).trim();
					const key = [...scope, label].join(':');
					const position = pos - queryNode.from;
					found = {
						queryPos: position >= 0 ? position : null,
						key
					};
					return false;
				}
				// We handle this case to show the preview for tag names which are selected inside other contexts
				case Term.Identifier: {
					// parent as tag should be impossible, because Term.TagDefinition tag would have stopped exploration
					if (!parent || parent.object == 'tag') {
						return false;
					}

					const label = state.doc.sliceString(node.from, node.to);
					if (parent.label === label) {
						return false;
					}
					const scope_copy = [...scope];
					while (scope_copy.pop()) {
						const key = [...scope_copy, label].join(':');
						if (deck.objects.has(key)) {
							found = {
								queryPos: null,
								key
							};
							return false;
						}
					}
				}
			}
		},
		leave: (node) => {
			switch (node.type.id) {
				case Term.ViewDefinition:
				case Term.GroupDefinition:
					scope.pop();
			}
		}
	});

	return found;
}

export function parseVeldtDeck(state: EditorState): Deck {
	const objects: Deck['objects'] = new Map();
	const views: string[] = [];
	const scope: string[] = [];
	let domain: string = '';

	const tree = syntaxTree(state);
	tree.iterate({
		enter: (node) => {
			const scope_str = scope.join(':');
			const parent: DeckObject | null = objects.get(scope_str) ?? null;

			switch (node.type.id) {
				case Term.ViewDefinition:
				case Term.GroupDefinition:
					const identifier = node.node.getChild(Term.Identifier);
					if (identifier === null) {
						return false;
					}
					const label = state.doc.sliceString(identifier.from, identifier.to);
					scope.push(label);
					if (node.type.is(Term.ViewDefinition)) {
						objects.set(label, {
							label,
							object: 'view',
							children: []
						});
						views.push(label);
					} else if (node.type.is(Term.GroupDefinition)) {
						const id = [...scope].join(':');
						objects.set(id, {
							label,
							scope: scope_str,
							object: 'group',
							children: []
						});
						if (parent && parent.object !== 'tag') {
							parent.children.push(id);
						}
					}

					return true;
				case Term.DomainDefinition: {
					const query = node.node.getChild('Query');

					if (query !== null) {
						if (domain.length > 0) domain += ' ';
						domain += state.doc.sliceString(query.from, query.to).trim();
					}
					return false;
				}
				case Term.TagDefinition: {
					const queryNode = node.node.getChild('Query');
					const ident = node.node.getChild(Term.Identifier);
					if (!queryNode || !ident) return false;
					const label = state.doc.sliceString(ident.from, ident.to);
					const query = state.doc.sliceString(queryNode.from, queryNode.to).trim();
					const id = [...scope, label].join(':');
					objects.set(id, { label, query, scope: scope_str, object: 'tag' });

					if (parent && parent.object !== 'tag') {
						parent.children.push(id);
					}

					return false;
				}
				case Term.Identifier: {
					// when we find an identifier, we look up the tree to see which symbol should be added
					if (!parent || parent.object == 'tag') {
						return false;
					}
					const label = state.doc.sliceString(node.from, node.to);
					if (parent.label === label) {
						return false;
					}
					const scope_copy = [...scope];
					while (scope_copy.pop()) {
						const potential_key = [...scope_copy, label].join(':');
						if (objects.has(potential_key)) {
							parent.children.push(potential_key);
							return false;
						}
					}
					parent.children.push(label);
				}
			}
		},
		leave: (node) => {
			switch (node.type.id) {
				case Term.ViewDefinition:
				case Term.GroupDefinition:
					scope.pop();
			}
		}
	});

	return { objects, views, domain };
}

export function addTag(state: EditorState, name: string, query: string): TransactionSpec {
	const text = `\ntag ${name} [ ${query} ]\n`;
	return {
		changes: { from: state.doc.length, insert: text }
	};
}

export function addView(state: EditorState, name: string): TransactionSpec {
	const text = `\nview ${name}() {\n\n}\n`;
	return {
		changes: { from: state.doc.length, insert: text }
	};
}
