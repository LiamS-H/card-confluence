<script lang="ts">
	import Button from '$components/button.svelte';
	import Card from '$components/card-img/card.svelte';
	import { use_deck_cards } from '$lib/sync/use-cards.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';

	const props: { card: CardObj; print: Print; width: number | string; zone: DeckZone } = $props();
	const deck_client = use_deck_cards();
</script>

<div class="relative">
	<div class="absolute -top-2 -right-2 z-10">
		<Button
			onclick={() => {
				deck_client.add_cards(props.card.oracle_id, props.print.scryfall_id, props.zone, 1);
			}}>+</Button
		>
	</div>
	<Card {...props} />
</div>
