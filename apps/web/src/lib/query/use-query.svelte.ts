import { query_client, query_to_string, type QueryRequest } from '$lib/query/client';

// export function use_query(query: QueryRequest) {
export function use_query(getQuery: () => QueryRequest) {
	const query = $derived(getQuery());

	$effect(() => {
		query_client.ensure_query(query);
	});

	return {
		get response() {
			const key = query_to_string(query);
			return query_client.queries.get(key) ?? { loading: true, error: false };
		}
	};
}
