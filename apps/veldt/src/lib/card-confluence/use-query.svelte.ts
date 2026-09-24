import { query_client, query_to_string, type QueryRequest } from '$lib';

export function use_query(getQuery: () => QueryRequest, debounce: number, manual_key?: string) {
	let timeout: NodeJS.Timeout;
	let key = $state(manual_key || query_to_string(getQuery()));

	$effect(() => {
		query_client.track_invalidations();
		const query = getQuery();
		const next_key = query_to_string(query);
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			key = next_key;
			query_client.ensure_query(query);
		}, debounce);
		return () => clearTimeout(timeout);
	});

	return {
		get response() {
			return query_client.queries.get(key) ?? { loading: true, error: false };
		},
		query_now: (query: QueryRequest) => {
			const next_key = query_to_string(query);
			key = next_key;
			query_client.ensure_query(query);
		}
	};
}
