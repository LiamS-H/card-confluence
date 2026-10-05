<script lang="ts">
	import { Button } from '$components/ui/button';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { uuid_to_string } from '$lib/utils/uuid';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';

	const props: { card: CardObj; print: Print } = $props();
	const deck = use_deck_cards();
	const oracle_id = $derived(uuid_to_string(props.card.oracle_id));
</script>

<div class="flex">
	<Button
		onclick={() => {
			deck.mutate.move_cards(oracle_id, 'considering', 'mainboard', 1);
		}}
	>
		main +
	</Button>
	{#if deck.settings.sideboard}
		<Button
			intent="secondary"
			onclick={() => {
				deck.mutate.move_cards(oracle_id, 'considering', 'sideboard', 1);
			}}
		>
			side +
		</Button>
	{/if}

	<Button
		intent="destructive"
		onclick={() => {
			deck.mutate.remove_cards(oracle_id, 'considering', 1);
		}}
	>
		-
	</Button>
</div>
