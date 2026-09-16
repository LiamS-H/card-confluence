import {
	LRLanguage,
	LanguageSupport,
	indentNodeProp,
	foldNodeProp,
	foldInside,
	delimitedIndent
} from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';
import { parseMixed } from '@lezer/common';
import { cardconfluenceLanguage, cardconfluence } from 'codemirror-lang-cardconfluence';
import { snippetCompletion } from '@codemirror/autocomplete';
import { deckStateField } from './deck_state';
import { parser } from './parser/parser';

export const veldtDeckLanguage = LRLanguage.define({
	parser: parser.configure({
		props: [
			indentNodeProp.add({
				ViewDefinition: delimitedIndent({ closing: '}', align: false }),
				GroupDefinition: delimitedIndent({ closing: '}', align: false }),
				TagDefinition: delimitedIndent({ closing: ']', align: false }),
				DomainDefinition: delimitedIndent({ closing: ']', align: false })
			}),
			foldNodeProp.add({
				ViewDefinition: foldInside,
				GroupDefinition: foldInside
			}),
			styleTags({
				TagKeyword: tags.keyword,
				ViewKeyword: tags.keyword,
				GroupKeyword: tags.keyword,
				DomainKeyword: tags.keyword,
				Identifier: tags.name,
				'[ ]': tags.squareBracket,
				'{ }': tags.brace,
				'( )': tags.paren,
				',': tags.separator,
				':': tags.punctuation
			})
		],
		wrap: parseMixed((node) => {
			if (node.name === 'Query') {
				return { parser: cardconfluenceLanguage.parser };
			}
			return null;
		})
	})
});

export function veldtDeck() {
	return new LanguageSupport(veldtDeckLanguage, [
		veldtDeckLanguage.data.of({
			autocomplete: [
				snippetCompletion('tag ${name} [ ${query} ]', {
					label: 'tag',
					detail: 'Define a new tag',
					type: 'keyword'
				}),
				snippetCompletion('group ${name} { ${tags} }', {
					label: 'group',
					detail: 'Define a new group',
					type: 'keyword'
				}),
				snippetCompletion('view ${name}() {\n\t${tags}\n}', {
					label: 'view',
					detail: 'Define a new view',
					type: 'keyword'
				}),
				snippetCompletion('domain [ ${query} ]', {
					label: 'domain',
					detail: 'Define a domain',
					type: 'keyword'
				})
			]
		}),
		cardconfluence().support,
		deckStateField
	]);
}

export {
	type Tag,
	type Deck,
	type View,
	type Group,
	type CursorTag,
	type DeckObject,
	deckStateField,
	onDeckUpdate,
	parseVeldtDeck,
	tagAtCursor,
	addTag,
	addView
} from './deck_state';
