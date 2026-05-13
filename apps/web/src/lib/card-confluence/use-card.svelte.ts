import { query_client } from '$lib/card-confluence/client.svelte';

export function use_card(getId: () => string, debounce?: number, key?: string) {
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
			return query_client.cards.get(id) ?? { loading: true, error: false };
		}
	};
}
