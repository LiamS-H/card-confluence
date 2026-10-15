import * as Y from 'yjs';
import { query_client } from '$lib';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
	veldtDeck,
	onDeckUpdate,
	deckStateField,
	type Deck as VeldtDeckParsed,
	type CursorTag,
	onCursorTagUpdate,
	cursorTagStateField
} from 'codemirror-lang-veldt-deck';
import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
import { yCollab } from 'y-codemirror.next';
import { veldtSetup } from '$lib/codemirror';

export class TagDocState {
	private _doc_parsed = $state<VeldtDeckParsed>() as VeldtDeckParsed;
	private _cursor_tag: CursorTag | null = $state(null);
	private _view: EditorView;

	constructor(ytext: Y.Text, on_doc_parsed: (parsed: VeldtDeckParsed, eager?: boolean) => void) {
		const undoManager = new Y.UndoManager(ytext);
		const state = EditorState.create({
			doc: ytext.toJSON(),
			extensions: [
				veldtSetup,
				veldtDeck(),
				cardconfluenceWithContext({
					complete: async (pos: number) => {
						const tag = this._view.state.field(cursorTagStateField);
						if (tag === null || tag.queryPos === null) {
							return { from: pos, to: pos, options: [] };
						}
						// TODO: add domain as part of query
						const offset = pos - tag.queryPos;
						const { from, to, options } = await query_client.autocomplete(
							{ query: tag.tag.query },
							tag.queryPos
						);
						return { options, from: from + offset, to: to + offset };
					}
				}),
				yCollab(ytext, null, { undoManager }),
				onDeckUpdate((parsed) => {
					this._doc_parsed = parsed;
					on_doc_parsed(parsed);
				}),
				onCursorTagUpdate((tag) => {
					this._cursor_tag = tag;
				}),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' }
				})
			]
		});
		this._view = new EditorView({ state });
		this._doc_parsed = this._view.state.field(deckStateField);
		on_doc_parsed(this._doc_parsed, true);
	}

	[Symbol.dispose]() {
		this._view?.destroy();
	}

	get view(): EditorView {
		return this._view;
	}

	get parsed() {
		return this._doc_parsed;
	}

	get cursor_tag() {
		return this._cursor_tag;
	}
}
