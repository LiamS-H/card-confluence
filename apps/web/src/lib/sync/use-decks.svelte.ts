import type { DeckStruct } from '@repo/schema-sync';
import { sync_client } from './client';
import * as Y from 'yjs';

export function use_decks() {
	const root = sync_client.get_root();
	let decks = $state(Array.from(root.keys()));

	$effect(() => {
		function observer(e: Y.YMapEvent<DeckStruct>) {
			console.log('test');
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
