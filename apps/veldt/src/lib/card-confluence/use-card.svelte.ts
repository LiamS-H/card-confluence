import { query_client } from '$lib';
import { uuid_key } from '$lib/utils/uuid';
import type { Card } from '@card-confluence/wasm-browser';

export function use_card(
	getId: () => Card['oracle_id'],
	debounce?: number,
	key?: string | undefined
) {
	const id = $derived(getId());
	key ??= crypto.randomUUID();
	let timeout: NodeJS.Timeout;

	$effect(() => {
		query_client.track_invalidations();
		if (debounce) {
			timeout = setTimeout(() => query_client.ensure_card(id, key), debounce);
		} else {
			query_client.ensure_card(id, key);
		}
		return () => clearTimeout(timeout);
	});

	return {
		get card() {
			return query_client.cards.get(uuid_key(id)) ?? { loading: true, error: false };
		}
	};
}
