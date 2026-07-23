<script lang="ts">
	import Error from '$components/card-img/error.svelte';
	import type { DetailedCard, Print } from '$lib';
	import type { Snippet } from 'svelte';

	const {
		card,
		matched_prints,
		width,
		children
	}: {
		card: DetailedCard;
		matched_prints: string[];
		width: string | number;
		children: Snippet<[{ card: DetailedCard; print: Print; width: string | number }]>;
	} = $props();

	let print = $derived(card.prints.find((p) => matched_prints.includes(p.scryfall_id)));
</script>

{#if print}
	{@render children({ card, print, width })}
{:else}
	<Error message={`${card.name}, ${matched_prints} Couldn't find matching print`} />
{/if}
