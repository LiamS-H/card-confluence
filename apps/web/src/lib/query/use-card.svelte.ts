import { query_client } from '$lib/query/client';

// export function use_query(query: QueryRequest) {
export function use_card(getId: () => string, key?: string) {
	const id = $derived(getId());
	key ??= crypto.randomUUID();
	$effect(() => {
		query_client.ensure_card(id, key);
	});

	return {
		get card() {
			return query_client.cards.get(id) ?? { loading: true, error: false };
		}
	};
}
