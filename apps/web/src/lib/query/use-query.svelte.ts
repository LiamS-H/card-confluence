import { query_client, query_to_string, type QueryRequest } from '$lib/query/client.svelte';

export function use_query(getQuery: () => QueryRequest, debounce: number) {
	let timeout: NodeJS.Timeout;

	$effect(() => {
		query_client.track_invalidations();
		const query = getQuery();
		if (debounce) {
			timeout = setTimeout(() => query_client.ensure_query(query), debounce);
		} else {
			query_client.ensure_query(query);
		}
		return () => clearTimeout(timeout);
	});

	return {
		get response() {
			const key = query_to_string(getQuery());
			return query_client.queries.get(key) ?? { loading: true, error: false };
		}
	};
}
