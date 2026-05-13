import {
	query_client,
	query_to_string,
	type QueryRequest
} from '$lib/card-confluence/client.svelte';

export function use_query(getQuery: () => QueryRequest, debounce: number) {
	let timeout: NodeJS.Timeout;
	let key = $state(query_to_string(getQuery()));

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
		}
	};
}
