import * as Y from 'yjs';
import { getContext, setContext } from 'svelte';
import { sync_client, use_query, query_client } from '$lib';
import { SvelteMap } from 'svelte/reactivity';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
	veldtDeck,
	deckStateField,
	tagAtCursor,
	onDeckUpdate,
	type Deck as VeldtDeckParsed,
	type Tag,
	type Deck,
	type CursorTag
} from 'codemirror-lang-veldt-deck';
import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
import { yCollab } from 'y-codemirror.next';
import { veldtSetup } from '$lib/codemirror';

import type {
	DeckStruct,
	DeckCard,
	DeckZone,
	OracleCard,
	OracleCardSerialized
} from '@repo/schema-sync';

const DECK_CARD_INTERFACE_KEY = Symbol('deck_card_interface');

class TagQuery {
	tag: Tag = $state({ query: '', object: 'tag', label: '', scope: '' });
	domain = '';

	data!: ReturnType<typeof use_query>;
	private cleanupRoot: () => void;

	matchedIds: Map<string, string[]> = $derived.by(() => {
		if (!this.data || this.data.response.loading || this.data.response.error) {
			return new SvelteMap();
		}
		return new SvelteMap(
			this.data.response.result.rows.map((r) => [r.oracle_id, r.matched_prints])
		);
	});

	constructor(tag: Tag, domain: string) {
		this.tag = tag;
		this.domain = domain;

		this.cleanupRoot = $effect.root(() => {
			this.data = use_query(() => ({ query: this.domain + ' ' + this.tag.query }), 500);
		});
	}

	destroy() {
		this.cleanupRoot();
	}
}

export class DeckCardInterface {
	private deck: DeckStruct;

	private doc_parsed = $state<VeldtDeckParsed>({ domain: '', views: [], objects: new Map() });

	cursor_tag: CursorTag | null = $state(null);

	// this is not ideal, since any change will update everything. But it works for now :p
	private sync_tick = $state(0);

	tags_fetched: Map<string, TagQuery> = new SvelteMap();

	private _view!: EditorView;

	constructor(deck: DeckStruct) {
		this.deck = deck;

		if (!deck.doc) {
			this.deck.set('doc', new Y.Text(''));
		}

		const ytext = this.deck.get('doc') as Y.Text;
		const undoManager = new Y.UndoManager(ytext);

		const state = EditorState.create({
			doc: ytext.toJSON(),
			extensions: [
				veldtSetup,
				veldtDeck(),
				cardconfluenceWithContext({
					complete: async (pos: number) => {
						// Always reads from the live view state — no stale closure
						const tag = tagAtCursor(this._view!.state, pos);
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
					this.set_doc_parsed(parsed);
				}),
				EditorView.updateListener.of((update) => {
					if (update.docChanged || update.selectionSet) {
						this.cursor_tag = tagAtCursor(update.state, update.state.selection.main.head);
					}
				}),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' }
				})
			]
		});

		this._view = new EditorView({ state });

		this.set_doc_parsed(this._view.state.field(deckStateField));
		console.log('test', this._view.state.field(deckStateField));

		this.deck.observeDeep(() => {
			this.sync_tick += 1;
		});
	}

	[Symbol.dispose]() {
		this._view?.destroy();
	}

	get doc_obj() {
		return this.doc_parsed;
	}

	get_view(): EditorView {
		return this._view;
	}

	set_doc_parsed(deck: Deck) {
		this.doc_parsed = deck;
		this.on_doc_parsed();
	}

	private on_doc_parsed() {
		const deck = this.doc_parsed;
		for (const key of this.tags_fetched.keys()) {
			const obj = deck.objects.get(key);
			if (!obj || obj.object !== 'tag') {
				this.tags_fetched.delete(key);
			}
		}
		for (const [key, obj] of deck.objects.entries()) {
			if (obj.object !== 'tag') continue;
			const current_query = this.tags_fetched.get(key);
			if (
				current_query &&
				current_query.tag.query === obj.query &&
				current_query.domain === deck.domain
			) {
				continue;
			}
			this.tags_fetched.set(key, new TagQuery(obj, deck.domain));
		}
	}

	move_cards(oracle_id: string, src: DeckZone, dest: DeckZone, amount: number): void {
		const cards = this.deck.get('cards');
		const oracle_entry = cards.get(oracle_id);

		if (!oracle_entry) {
			throw Error(`No oracle entry found for ${oracle_id}`);
		}

		const instances = oracle_entry.get('instances');
		if (!instances) return;

		let moved = 0;

		sync_client.get_doc().transact(() => {
			for (const [y_id, card] of instances.entries()) {
				if (moved >= amount) break;

				if (card.zone === src) {
					instances.set(y_id, { ...card, zone: dest });
					moved++;
				}
			}
		});
	}

	remove_cards(oracle_id: string, zone: DeckZone, amount: number): void {
		const cards = this.deck.get('cards');
		const oracle_entry = cards.get(oracle_id);
		if (!oracle_entry) return;

		const instances = oracle_entry.get('instances');
		if (!instances) return;

		let deleted = 0;

		sync_client.get_doc().transact(() => {
			for (const [y_id, card] of instances.entries()) {
				if (deleted >= amount) break;

				if (card.zone === zone) {
					instances.delete(y_id);
					deleted++;
				}
			}

			if (instances.size === 0) {
				cards.delete(oracle_id);
			}
		});
	}

	public add_cards(oracle_id: string, scryfall_id: string, zone: DeckZone, amount: number): void {
		sync_client.get_doc().transact(() => {
			const cards = this.deck.get('cards');
			let oracle_entry = cards.get(oracle_id);

			if (!oracle_entry) {
				oracle_entry = new Y.Map() as OracleCard;
				oracle_entry.set('instances', new Y.Map<DeckCard>());
				cards.set(oracle_id, oracle_entry);
			}

			const instances = oracle_entry.get('instances');

			for (let _ = 0; _ < amount; _++) {
				const y_id = crypto.randomUUID();
				instances.set(y_id, { y_id, oracle_id, scryfall_id, zone });
			}
		});
	}

	private get_cards_by_zone(target_zone: DeckZone): OracleCardSerialized[] {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used for reactivity
		this.sync_tick;
		const result: OracleCardSerialized[] = [];
		const cards = this.deck.get('cards');

		if (!cards) return result;

		cards.forEach((oracle_entry, oracle_id) => {
			const instances = oracle_entry.get('instances');
			const cards: DeckCard[] = [];
			instances.forEach((card) => {
				if (card.zone === target_zone) cards.push(card);
			});
			if (cards.length > 0) {
				result.push({ instances: cards, oracle_id });
			}
		});
		return result;
	}

	get_card_counts(oracle_id: string): Record<DeckZone | 'total', number> {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		this.sync_tick;

		const counts: Record<DeckZone | 'total', number> = {
			mainboard: 0,
			sideboard: 0,
			considering: 0,
			commander: 0,
			total: 0
		};

		const cards = this.deck.get('cards');
		if (!cards) return counts;

		const oracle_entry = cards.get(oracle_id);
		if (!oracle_entry) return counts;

		const instances = oracle_entry.get('instances');
		if (instances) {
			instances.forEach((card) => {
				counts[card.zone]++;
			});
			counts['total']++;
		}

		return counts;
	}

	get main_deck() {
		return this.get_cards_by_zone('mainboard');
	}
	get sideboard() {
		return this.get_cards_by_zone('sideboard');
	}
	get considering() {
		return this.get_cards_by_zone('considering');
	}

	get settings() {
		// replace with either yjs, or codemirror docstate
		return { singleton: true, sideboard: false };
	}

	get commander() {
		return this.get_cards_by_zone('commander');
	}
}

export function use_deck_cards_provider(getDeck: () => DeckStruct): DeckCardInterface {
	const deck_interface = $derived(new DeckCardInterface(getDeck()));
	setContext(DECK_CARD_INTERFACE_KEY, deck_interface);
	$effect(() => {
		setContext(DECK_CARD_INTERFACE_KEY, deck_interface);
	});
	return deck_interface;
}

export function use_deck_cards(): DeckCardInterface {
	return getContext(DECK_CARD_INTERFACE_KEY) as DeckCardInterface;
}
