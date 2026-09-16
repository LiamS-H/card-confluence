import { StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import * as Term from './parser/parser.terms';
// Term.Query ends up breaking, because it is parsed inside the child language

import { syntaxTree } from '@codemirror/language';
import type { EditorState, TransactionSpec } from '@codemirror/state';

export type DeckObject = Tag | Group | View;

export interface Tag {
	object: 'tag';
	label: string;
	scope: string;
	query: string;
}

export interface Group {
	object: 'group';
	label: string;
	scope: string;
	children: string[];
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

export interface CursorTag {
	name: string;
	query: string;
	queryPos: number | null;
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

export function tagAtCursor(state: EditorState, pos: number): CursorTag | null {
	const tree = syntaxTree(state);

	let found: CursorTag | null = null;
	tree.iterate({
		from: pos,
		to: pos,
		enter: (node) => {
			if (node.type.is(Term.DomainDefinition) && node.from <= pos && pos <= node.to) {
				const queryNode = node.node.getChild('Query');
				if (queryNode) {
					const position = pos - queryNode.from;
					found = {
						name: 'domain',
						query: state.doc.sliceString(queryNode.from, queryNode.to).trim(),
						queryPos: position >= 0 ? position : null
					};
				}
				return false;
			}
			if (node.type.is(Term.TagDefinition) && node.from <= pos && pos <= node.to) {
				const nameNode = node.node.getChild(Term.Identifier);
				const queryNode = node.node.getChild('Query');
				if (nameNode && queryNode) {
					const position = pos - queryNode.from;
					found = {
						name: state.doc.sliceString(nameNode.from, nameNode.to),
						query: state.doc.sliceString(queryNode.from, queryNode.to).trim(),
						queryPos: position >= 0 ? position : null
					};
				}
				return false;
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
