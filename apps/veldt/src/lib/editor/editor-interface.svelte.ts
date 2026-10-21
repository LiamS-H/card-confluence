import * as Y from 'yjs';
import { DeckCardInterface } from '$lib/sync/use-deck-cards.svelte';
import type { DeckStruct } from '@repo/schema-sync';
import { getContext, setContext } from 'svelte';
import { type TagDocStateOnParsedCallback, TagDocState } from '$lib/editor/tag-doc.svelte';

import { type View } from 'codemirror-lang-veldt-deck';
import { DEFAULT_VIEW_ID, PRESET_VIEWS, type VirtualView } from './view.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { TagQuery } from '$lib/editor/tags.svelte';

import type { VeldtSettings } from '$lib/settings';
import type { DeepPartial } from '$lib/utils/object';

const DECK_CARD_INTERFACE_KEY = Symbol('deck_card_interface');

export class DeckEditInterface {
	private deck_card_interface: DeckCardInterface;
	private tag_doc_state: TagDocState;

	private base_views: Record<string, VirtualView>;
	private defualt_view_id = DEFAULT_VIEW_ID;
	private _active_view_id: string = $state('');

	private doc_view_tags: Map<string, TagQuery> = new SvelteMap();

	constructor(deck: DeckStruct) {
		this.base_views = PRESET_VIEWS;
		this.deck_card_interface = new DeckCardInterface(deck);
		this.defualt_view_id = this.defualt_view_id;

		if (!deck.doc) {
			deck.set('doc', new Y.Text(''));
		}

		const ytext = deck.get('doc') as Y.Text;

		this.tag_doc_state = new TagDocState(ytext, (...p) => this.on_doc_parsed(...p));
	}

	private on_doc_parsed: TagDocStateOnParsedCallback = (deck, eager) => {
		for (const [key, view_tag] of this.doc_view_tags.entries()) {
			if (view_tag.tag.object === 'tag') {
				const deck_tag = deck.objects.get(key);
				if (!deck_tag || deck_tag.object !== 'tag') {
					view_tag.destroy?.();
					this.doc_view_tags.delete(key);
				}
				continue;
			}
		}
		for (const [key, deck_tag] of deck.objects.entries()) {
			if (deck_tag.object !== 'tag') continue;
			const view_tag = this.doc_view_tags.get(key);
			if (view_tag && view_tag.tag.query === deck_tag.query) {
				continue;
			}
			if (view_tag) {
				view_tag.destroy?.();
			}
			this.doc_view_tags.set(
				key,
				new TagQuery({ ...deck_tag, query: deck_tag.query }, eager ?? false)
			);
		}

		if (!this.view_ids.includes(this._active_view_id)) {
			this._active_view_id = this.defualt_view_id;
		}
	};

	get cards() {
		return this.deck_card_interface;
	}

	get tag_doc() {
		return this.tag_doc_state;
	}

	get view_tags() {
		return this.doc_view_tags;
	}

	get_view(view_id: string): View | VirtualView {
		const deck = this.tag_doc_state.parsed;
		if (deck.views.some((p) => p.toLowerCase() === view_id.toLowerCase())) {
			return deck.objects.get(view_id) as View;
		}
		return this.base_views[view_id];
	}

	get view_ids(): string[] {
		if (!this.tag_doc_state) return [];
		const doc_views_keys = this.tag_doc_state.parsed.views;
		const preset_keys = new Set(Object.keys(this.base_views));
		for (const doc_key of doc_views_keys) {
			const lower_doc_key = doc_key.toLowerCase();
			if (preset_keys.has(lower_doc_key)) {
				preset_keys.delete(lower_doc_key);
			}
		}
		return [...doc_views_keys, ...preset_keys];
	}

	set_active_view(id: string) {
		if (!this.view_ids.includes(id)) {
			return;
		}
		this._active_view_id = id;
	}

	get active_view() {
		return this._active_view_id;
	}

	get settings() {
		// TODO: replace with either yjs, or codemirror docstate
		return { singleton: true, sideboard: false, commander: true };
	}

	get settings_overrides() {
		return {} as DeepPartial<VeldtSettings>;
	}
}

export function use_deck_edit_provider(getDeck: () => DeckStruct): DeckEditInterface {
	const deck_interface = $derived(new DeckEditInterface(getDeck()));
	setContext(DECK_CARD_INTERFACE_KEY, deck_interface);
	$effect(() => {
		setContext(DECK_CARD_INTERFACE_KEY, deck_interface);
	});
	return deck_interface;
}

export function use_deck_edit(): DeckEditInterface {
	const context = getContext(DECK_CARD_INTERFACE_KEY) as DeckEditInterface;
	return context;
}
