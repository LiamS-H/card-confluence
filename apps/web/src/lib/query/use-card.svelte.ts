import { query_client } from '$lib/query/client';

// export function use_query(query: QueryRequest) {
export function use_card(getId: () => string, tag?: string, debounce?: number) {
	tag ??= crypto.randomUUID();
	const id = $derived(getId());
	$effect(() => {
		query_client.ensure_card(id, tag, debounce);
	});
	return {
		get card() {
			return query_client.cards.get(id) ?? { loading: true, error: false };
		}
	};
}
