<script lang="ts">
	import Card from '$components/card-img/card.svelte';
	import Error from '$components/card-img/error.svelte';
	import type { DetailedCard } from '$lib/query/client.svelte';

	const {
		card,
		matched_prints,
		width
	}: { card: DetailedCard; matched_prints: string[]; width: number } = $props();

	let print = $derived(card.prints.find((p) => matched_prints.includes(p.scryfall_id)));
</script>

{#if print}
	<Card {card} {print} {width} />
{:else}
	<Error message={`${card.name}, ${matched_prints} Couldn't find matching print`} />
{/if}
