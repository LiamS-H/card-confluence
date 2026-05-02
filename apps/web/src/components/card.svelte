<script lang="ts">
	import { use_card } from '$lib';

	const { id, key }: { id: string; key?: string } = $props();

	let { card } = $derived(use_card(() => id, key));

	$effect(() => {
		if (!card.loading && !card.error) {
			console.log(card.result);
		}
	});
</script>

{#if card.loading}
	<p>Loading...</p>
{:else if card.error}
	<p>Error: {card.message}</p>
{:else}
	<div>
		<span>{card.result.name}</span>
		<p>{card.result.oracle_text}</p>
	</div>
{/if}
