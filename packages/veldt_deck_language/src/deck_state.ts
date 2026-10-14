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

const groupDefaultSettings: GroupSettings = {};
export interface GroupSettings {}
export interface Group {
	object: 'group';
	settings: GroupSettings;
	label: string;
	scope: string;
	children: string[];
}

// TODO: It makes sense to treat the match macro like a normal group, this way
// the state and matching can be used for suggestions or to preview which keywords get included
// export interface Match {
// 	object: 'match';
// 	scope: string;
// 	children: string[];
// }

const viewDefaultSettings: ViewSettings = {
	showUnmatched: false,
	showEmpty: false
} as const;
export interface ViewSettings {
	showUnmatched: boolean;
	showEmpty: boolean;
}
export interface View {
	object: 'view';
	settings: ViewSettings;
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

export type CursorTag =
	| {
			tag: Tag;
			key: string;
			queryPos: number | null;
	  }
	| {
			key: 'domain';
			queryPos: number | null;
			tag: { query: string };
	  };

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
				tag: { query: deck.domain }
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
				tag: { query: deck.domain }
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

	const match_definitions: {
		parent_key: string;
		match_string: string;
	}[] = [];

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
							object: 'view',
							label,
							settings: { ...viewDefaultSettings },
							children: []
						});
						views.push(label);
					} else if (node.type.is(Term.GroupDefinition)) {
						const id = [...scope].join(':');
						objects.set(id, {
							object: 'group',
							label,
							settings: { ...groupDefaultSettings },
							scope: scope_str,
							children: []
						});
						if (parent && parent.object !== 'tag') {
							parent.children.push(id);
						}
					}

					return true;
				case Term.ParamItem: {
					if (!parent) return false;
					const param = node.node.getChild(Term.ParamKey);
					const value = node.node.getChild(Term.ParamValue);

					if (!param || !value || parent.object === 'tag') {
						return true;
					}

					const key = state.doc.sliceString(param.from, param.to);

					if (!Object.hasOwn(parent.settings, key)) {
						return true;
					}
					const val = state.doc.sliceString(value.from, value.to);
					// TODO: when adding linting, the type should be checked more thouroughly
					try {
						//@ts-expect-error; the key is already checked against the object
						parent.settings[key] = JSON.parse(val);
					} catch {
						//@ts-expect-error; the key is already checked against the object
						parent.settings[key] = val;
					}
					return true;
				}
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
					objects.set(id, {
						object: 'tag',
						label,
						query,
						scope: scope_str
					});

					if (parent && parent.object !== 'tag') {
						parent.children.push(id);
					}

					return false;
				}
				case Term.Identifier: {
					// when we find an identifier, we look up the tree to see which symbol should be added
					if (!parent || parent.object === 'tag') {
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
					return true;
				}

				case Term.MatchDefinition: {
					const match = node.node.getChild(Term.MatchString);
					if (!match) return false;
					if (!parent || parent.object === 'tag') {
						return false;
					}
					let match_string = state.doc.sliceString(match.from, match.to);
					if (match_string[0] === '"' && match_string[match_string.length - 1] === '"') {
						match_string = match_string.substring(1, match_string.length - 1);
					}
					match_definitions.push({ match_string, parent_key: scope_str });
					return false;
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

	// Resolve matched after all keys exist
	for (const { match_string, parent_key } of match_definitions) {
		const parent = objects.get(parent_key);
		if (!parent || parent.object === 'tag') continue;
		const matches: string[] = [];

		const contents = new Set(parent.children);

		// TODO: make more dynamic with a regex replacement that supports *
		// didn't implement now because the main features we want are simple
		// and the syntax isn't clear. We mostly want a simple way to match
		// all scope 0 tags, but match "" seems a little cumbersome for this
		if (match_string === '') {
			// TODO, this is slow for large files due to the n * m nature, could definitely be done in n + m
			for (const [key, obj] of objects) {
				if (obj.object === 'view') continue;
				if (contents.has(key)) continue;
				if (!key.includes(':')) {
					matches.push(key);
					contents.add(key);
				}
			}
		} else {
			for (const [key, obj] of objects) {
				if (obj.object === 'view') continue;
				if (contents.has(key)) continue;
				if (key.startsWith(match_string)) {
					matches.push(key);
					contents.add(key);
				}
			}
		}
		parent.children.push(...matches);
	}

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
