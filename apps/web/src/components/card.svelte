<script lang="ts">
	import { use_card } from '$lib';

	const { id, key, debounce }: { id: string; key?: string; debounce?: number } = $props();

	let { card } = $derived(use_card(() => id, key, debounce));
</script>

{#if card.loading}
	<p>Loading...</p>
{:else if card.error}
	<p>Error: {card.message}</p>
{:else}
	<div>
		<span>{card.card.name}</span>
		<p>{card.card.oracle_text}</p>
	</div>
{/if}
