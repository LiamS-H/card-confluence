import { query_client, query_to_string, type QueryRequest } from '$lib/query/client';

// export function use_query(query: QueryRequest) {
export function use_query(getQuery: () => QueryRequest, tag?: string, debounce?: number) {
	tag ??= crypto.randomUUID();
	const query = $derived(getQuery());

	$effect(() => {
		query_client.ensure_query(query, tag, debounce);
	});

	return {
		get response() {
			const key = query_to_string(query);
			return query_client.responses.get(key) ?? { loading: true, error: false };
		}
	};
}
