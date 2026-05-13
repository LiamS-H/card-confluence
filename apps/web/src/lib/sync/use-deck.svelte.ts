import type { DeckStruct } from '@repo/schema-sync';
import { sync_client } from './client';
import * as Y from 'yjs';

export interface DeckMeta {
	doc: string;
}

export function use_deck_meta(id: () => string) {
	const root = sync_client.get_root();
	let deck = root.get(id());
	const out = $derived<{ error: string } | { error: null; deck: DeckMeta }>(
		deck ? { deck: deck.toJSON() as DeckMeta, error: null } : { error: 'Deck not found' }
	);

	$effect(() => {
		function observer(e: Y.YMapEvent<DeckStruct>) {
			if (e.keysChanged.has(id())) {
				deck = root.get(id());
			}
		}
		root.observe(observer);
		return () => root.unobserve(observer);
	});

	$effect(() => {
		function observer(_e: Y.YMapEvent<Y.Text>) {
			// eslint-disable-next-line no-self-assign -- to trigger derived to update the json deck
			deck = deck;
		}
		deck?.observe(observer);
		return () => deck?.unobserve(observer);
	});

	function delete_deck() {
		root.delete(id());
	}

	return {
		get deck() {
			return out;
		},
		delete_deck
	};
}

export function use_deck(id: () => string) {
	const root = sync_client.get_root();
	let deck = root.get(id());
	const out = $derived<{ error: string } | { error: null; deck: DeckStruct }>(
		deck ? { deck, error: null } : { error: 'Deck not found' }
	);
	$effect(() => {
		function observer(e: Y.YMapEvent<DeckStruct>) {
			if (e.keysChanged.has(id())) {
				deck = root.get(id());
			}
		}
		root.observe(observer);
		return () => root?.unobserve(observer);
	});
	return {
		get deck() {
			return out;
		}
	};
}
