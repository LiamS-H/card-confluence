import type { DeckStruct, DeckSerialized } from '@repo/schema-sync';
import { sync_client } from './client';
import * as Y from 'yjs';

export function use_deck_meta(id: () => string) {
	const root = sync_client.get_root();
	let deck = $state<DeckStruct | undefined>(root.get(id()));

	const out = $derived<{ error: string } | { error: null; deck: DeckSerialized }>(
		deck ? { deck: deck.toJSON(), error: null } : { error: 'Deck not found' }
	);

	$effect(() => {
		const currentId = id();
		deck = root.get(currentId);

		function rootObserver(e: Y.YMapEvent<DeckStruct>) {
			if (e.keysChanged.has(currentId)) {
				deck = root.get(currentId);
			}
		}
		root.observe(rootObserver);

		return () => root.unobserve(rootObserver);
	});

	$effect(() => {
		if (!deck) return;

		const deckObserver = () => {
			// eslint-disable-next-line no-self-assign
			deck = deck;
		};

		deck.observe(deckObserver);
		return () => deck?.unobserve(deckObserver);
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

export function use_deck_yjs(id: () => string) {
	const root = sync_client.get_root();
	let deck = $state<DeckStruct | undefined>(undefined);

	const out = $derived<{ error: string } | { error: null; deck: DeckStruct }>(
		deck ? { deck, error: null } : { error: 'Deck not found' }
	);

	$effect(() => {
		const currentId = id();
		deck = root.get(currentId);

		function observer(e: Y.YMapEvent<DeckStruct>) {
			if (e.keysChanged.has(currentId)) {
				deck = root.get(currentId);
			}
		}
		root.observe(observer);
		return () => root.unobserve(observer);
	});

	return {
		get deck() {
			return out;
		}
	};
}
