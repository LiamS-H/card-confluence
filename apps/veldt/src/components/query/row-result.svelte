<script lang="ts">
	import Error from '$components/card-img/error.svelte';
	import Loading from '$components/card-img/loading.svelte';
	import { use_card } from '$lib';
	import type { QueryResultRow, DetailedCard, Print } from '$lib';
	import ResultCard from './result-card.svelte';
	import type { Snippet } from 'svelte';

	const {
		result,
		key,
		children
	}: {
		result: QueryResultRow;
		key: string;
		children: Snippet<[{ card: DetailedCard; print: Print; width: string | number }]>;
	} = $props();

	let { card } = $derived(use_card(() => result.oracle_id, 100, key));
</script>

{#if card.loading}
	<Loading width="100%" />
{:else if card.error}
	<Error message={card.message} />
{:else}
	<ResultCard width="100%" card={card.result} matched_prints={result.matched_prints} {children} />
{/if}
