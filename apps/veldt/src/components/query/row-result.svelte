<script lang="ts">
	import { use_card } from '$lib';
	import type { QueryResultRow, DetailedCard, Print } from '$lib';
	import type { Snippet } from 'svelte';
	// This component wraps a card response and simplifies the parsing to split between Loading, Error, and CardRepresenation

	const {
		result,
		key,
		success,
		error,
		loading
	}: {
		result: QueryResultRow;
		key?: string | undefined;
		success: Snippet<[{ card: DetailedCard; print: Print }]>;
		error: Snippet<[{ message: string }]>;
		loading: Snippet<[]>;
	} = $props();

	let { card } = $derived(use_card(() => result.oracle_id, 100, key));
</script>

{#if card.loading}
	{@render loading()}
{:else if card.error}
	{@render error({ message: card.message })}
{:else}
	{const print = $derived(
		card.result.prints.find((p) => result.matched_prints.includes(p.scryfall_id))
	)}

	{#if print}
		{@render success({ card: card.result, print })}
	{:else}
		{@render error({
			message: `${card.result.name}, ${result.matched_prints} Couldn't find matching print`
		})}
	{/if}
{/if}
