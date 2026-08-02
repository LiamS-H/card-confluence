// editor-setup.ts
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

import {
	rectangularSelection,
	crosshairCursor,
	highlightSpecialChars,
	drawSelection
} from '@codemirror/view';

export const theme = EditorView.theme(
	{
		'&': {
			backgroundColor: 'var(--color-background)',
			color: 'var(--color-foreground)',

			fontSize: '18px',
			fontFamily: 'var(--font-sans)',

			border: '2px solid var(--color-foreground)',
			outline: 'none',
			margin: '-1px 0',

			transition: 'border-color 120ms ease, box-shadow 120ms ease'
		},

		'&.cm-focused': {
			outline: 'none',
			borderColor: 'var(--color-primary)',
			boxShadow: '0 0 0 1px var(--color-primary)'
		},

		'.cm-scroller': {
			padding: '18px',
			lineHeight: '1.55'
		},

		'.cm-content': {
			caretColor: 'var(--color-primary)'
		},

		'.cm-cursor, .cm-dropCursor': {
			borderLeft: '2px solid var(--color-primary)'
		},

		'.cm-selectionBackground, ::selection': {
			backgroundColor: 'color-mix(in srgb, var(--color-secondary) 35%, transparent) !important'
		},

		'.cm-activeLine': {
			backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, transparent)'
		},

		/**
		 * remove gutters / line numbers
		 */
		'.cm-gutters': {
			display: 'none'
		},

		/**
		 * search
		 */
		'.cm-searchMatch': {
			backgroundColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)',
			outline: '1px solid var(--color-primary)'
		},

		'.cm-searchMatch.cm-searchMatch-selected': {
			backgroundColor: 'var(--color-primary)',
			color: 'var(--color-primary-foreground)'
		},

		/**
		 * autocomplete / tooltips
		 */
		'.cm-tooltip': {
			backgroundColor: 'var(--color-background)',
			color: 'var(--color-foreground)',
			border: '2px solid var(--color-foreground)',
			borderRadius: 0
		},

		'.cm-tooltip-autocomplete ul li[aria-selected]': {
			backgroundColor: 'var(--color-primary)',
			color: 'var(--color-primary-foreground)'
		},

		/**
		 * matching brackets
		 */
		'.cm-matchingBracket': {
			color: 'var(--color-primary)',
			fontWeight: 'bold'
		}
	},
	{ dark: true }
);

export const veldtSetup: Extension = [
	highlightSpecialChars(),
	history(),
	drawSelection(),

	EditorState.allowMultipleSelections.of(true),

	syntaxHighlighting(defaultHighlightStyle, {
		fallback: true
	}),

	bracketMatching(),
	closeBrackets(),
	autocompletion(),

	rectangularSelection(),
	crosshairCursor(),

	highlightActiveLine(),
	highlightSelectionMatches(),

	keymap.of([
		indentWithTab,
		...defaultKeymap,
		...historyKeymap,
		...closeBracketsKeymap,
		...searchKeymap
	]),

	theme
];
