<script lang="ts">
	import Card from '$components/card-img/card.svelte';
	import Error from '$components/card-img/error.svelte';
	import type { DetailedCard } from '$lib/query/client.svelte';

	const { card, matched_prints }: { card: DetailedCard; matched_prints: string[] } = $props();

	let print = $derived(card.prints.find((p) => matched_prints.includes(p.scryfall_id)));
</script>

{#if print}
	<Card {card} {print} width={200} />
{:else}
	<Error message={`${card.name}, ${matched_prints} Couldn't find matching print`} />
{/if}
