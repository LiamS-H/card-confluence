import { query_client } from '$lib/query/client';

// export function use_query(query: QueryRequest) {
export function use_query(getId: () => string) {
	const id = $derived(getId());

	return {
		get card() {
			return query_client.cards.get(id) ?? undefined;
		}
	};
}
