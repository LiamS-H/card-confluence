<script lang="ts">
	import { use_deck_edit } from '$lib/editor';
	import { uuid_to_string } from '$lib/utils/uuid';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';
	import CardOptionsFullZone from './card-options-deck-full-zone.svelte';

	const props: {
		card: CardObj;
		print: Print;
	} = $props();
	const deck = use_deck_edit();

	const oracle_id = $derived(uuid_to_string(props.card.oracle_id));
	const scryfall_id = $derived(uuid_to_string(props.print.scryfall_id));
	const counts = $derived(deck.cards.get_card_counts(oracle_id));

	const zones = $derived.by(() => {
		const out: DeckZone[] = ['mainboard'];
		if (deck.settings.sideboard) {
			out.push('sideboard');
		}
		out.push('considering');
		if (deck.settings.commander) {
			out.push('commander');
		}
		return out;
	});
</script>

<div class="flex w-fit flex-col">
	{#each zones as zone}
		<CardOptionsFullZone {zone} {oracle_id} {scryfall_id} count={counts[zone]} />
	{/each}
</div>
