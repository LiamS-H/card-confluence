<script lang="ts">
	import Button from '$components/button.svelte';
	import Card from '$components/card-img/card.svelte';
	import { use_deck_cards } from '$lib/sync/use-cards.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';

	const props: { card: CardObj; print: Print; width: number | string } = $props();
	const deck = use_deck_cards();
</script>

<div class="relative">
	<div class="absolute -bottom-1 -left-1 z-10 flex items-center">
		<Button
			onclick={() => {
				deck.move_cards(props.card.oracle_id, 'considering', 'mainboard', 1);
			}}
		>
			main +
		</Button>
		<Button
			onclick={() => {
				deck.move_cards(props.card.oracle_id, 'considering', 'sideboard', 1);
			}}
		>
			side +
		</Button>
		<Button
			intent="destructive"
			onclick={() => {
				deck.remove_cards(props.card.oracle_id, 'considering', 1);
			}}
		>
			-
		</Button>
	</div>
	<Card {...props} />
</div>
