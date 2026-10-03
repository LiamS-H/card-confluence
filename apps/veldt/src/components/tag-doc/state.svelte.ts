import * as Y from 'yjs';
import { query_client, use_query, type QueryResultRow } from '$lib';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
	veldtDeck,
	tagAtCursor,
	onDeckUpdate,
	type Deck as VeldtDeckParsed,
	type Tag,
	type CursorTag,
	deckStateField
} from 'codemirror-lang-veldt-deck';
import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
import { yCollab } from 'y-codemirror.next';
import { veldtSetup } from '$lib/codemirror';
import { SvelteMap } from 'svelte/reactivity';
import { query_with_domain } from '$lib/utils';
import { uuid_to_string, type UUIDString } from '$lib/utils/uuid';

class TagQuery {
	tag: Tag = $state() as Tag;
	domain = '';

	data!: ReturnType<typeof use_query>;
	private cleanupRoot: () => void;

	matchedIds: Map<UUIDString, QueryResultRow['matched_prints']> = $derived.by(() => {
		if (!this.data || this.data.response.loading || this.data.response.error) {
			return new SvelteMap();
		}
		return new SvelteMap(
			this.data.response.result.rows.map((r) => [uuid_to_string(r.oracle_id), r.matched_prints])
		);
	});

	constructor(tag: Tag, eager: boolean) {
		this.tag = tag;
		let first_time = true;

		this.cleanupRoot = $effect.root(() => {
			this.data = use_query(() => ({ query: this.tag.query }), 500, `${tag.scope}:${tag.label}`);
			if (first_time && eager) {
				this.data.query_now({ query: this.tag.query });
			}
			first_time = false;
		});
	}

	destroy() {
		this.cleanupRoot();
	}
}

export class TagDocState {
	private _doc_parsed = $state<VeldtDeckParsed>() as VeldtDeckParsed;
	private _cursor_tag: CursorTag | null = $state(null);
	private _view: EditorView;
	private _tags_fetched: Map<string, TagQuery> = new SvelteMap();

	constructor(ytext: Y.Text) {
		const undoManager = new Y.UndoManager(ytext);
		const state = EditorState.create({
			doc: ytext.toJSON(),
			extensions: [
				veldtSetup,
				veldtDeck(),
				cardconfluenceWithContext({
					complete: async (pos: number) => {
						// Always reads from the live view state — no stale closure
						const tag = tagAtCursor(this._view.state, pos);
						if (tag === null || tag.queryPos === null) {
							return { from: pos, to: pos, options: [] };
						}
						const offset = pos - tag.queryPos;
						const { from, to, options } = await query_client.autocomplete(
							{ query: tag.query },
							tag.queryPos
						);
						return { options, from: from + offset, to: to + offset };
					}
				}),
				yCollab(ytext, null, { undoManager }),
				onDeckUpdate((parsed) => {
					this._doc_parsed = parsed;
					this.on_doc_parsed();
				}),
				EditorView.updateListener.of((update) => {
					if (update.docChanged || update.selectionSet) {
						this._cursor_tag = tagAtCursor(update.state, update.state.selection.main.head);
					}
				}),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' }
				})
			]
		});
		this._view = new EditorView({ state });
		this._doc_parsed = this._view.state.field(deckStateField);
		this.on_doc_parsed(true);
	}

	[Symbol.dispose]() {
		this._view?.destroy();
	}

	private on_doc_parsed(eager?: boolean) {
		const deck = this.parsed;
		for (const key of this._tags_fetched.keys()) {
			const obj = deck.objects.get(key);
			if (!obj || obj.object !== 'tag') {
				this._tags_fetched.delete(key);
			}
		}
		for (const [key, obj] of deck.objects.entries()) {
			if (obj.object !== 'tag') continue;
			const current_query = this._tags_fetched.get(key);
			if (
				current_query &&
				current_query.tag.query === obj.query &&
				current_query.domain === deck.domain
			) {
				continue;
			}
			this._tags_fetched.set(
				key,
				new TagQuery({ ...obj, query: query_with_domain(deck, obj.query) }, eager ?? false)
			);
		}
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

	get tags_fetched() {
		return this._tags_fetched;
	}
}
