<script lang="ts">
	import { Button } from '$components/ui/button';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';

	const props: { card: CardObj; print: Print } = $props();
	const deck = use_deck_cards();
</script>

<div class="flex">
	<Button
		onclick={() => {
			deck.mutate.move_cards(props.card.oracle_id, 'considering', 'mainboard', 1);
		}}
	>
		main +
	</Button>
	{#if deck.settings.sideboard}
		<Button
			intent="secondary"
			onclick={() => {
				deck.mutate.move_cards(props.card.oracle_id, 'considering', 'sideboard', 1);
			}}
		>
			side +
		</Button>
	{/if}

	<Button
		intent="destructive"
		onclick={() => {
			deck.mutate.remove_cards(props.card.oracle_id, 'considering', 1);
		}}
	>
		-
	</Button>
</div>
