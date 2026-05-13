import type { DeckStruct } from '@repo/schema-sync';
import { yjs_client } from './client';
import * as Y from 'yjs';

export function useDecks() {
	const root = yjs_client.get_root();
	let decks = $state(Array.from(root.keys()));

	$effect(() => {
		function observer(e: Y.YMapEvent<DeckStruct>) {
			console.log(e);
			if (e.keysChanged.size > 0) {
				decks = Array.from(root.keys());
			}
		}
		root.observe(observer);
		return () => root.unobserve(observer);
	});
	return {
		get ids() {
			return decks;
		}
	};
}
