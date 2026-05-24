<script lang="ts">
	import Button from '$components/button.svelte';
	import Card from '$components/card-img/card.svelte';
	import { use_deck_cards } from '$lib/sync/use-cards.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';

	const props: { card: CardObj; print: Print; width: number | string; zone: DeckZone } = $props();
	const deck = use_deck_cards();
	const counts = $derived(deck.get_card_counts(props.card.oracle_id));
</script>

<div class="relative">
	<div class="absolute -bottom-1 -left-1 z-10 flex items-center">
		{#if counts.total > 0}
			<Button
				intent="destructive"
				onclick={() => {
					if (counts.commander > 1) {
						deck.remove_cards(props.card.oracle_id, 'commander', 1);
						return;
					}
					if (counts.commander === 1) {
						if (counts.mainboard === 0) {
							deck.move_cards(props.card.oracle_id, 'commander', 'mainboard', 1);
						} else {
							deck.remove_cards(props.card.oracle_id, 'commander', 1);
						}
						return;
					}
					if (counts.mainboard > 1) {
						deck.remove_cards(props.card.oracle_id, 'mainboard', 1);
						return;
					}
					if (counts.mainboard === 1) {
						if (counts.considering === 0) {
							deck.move_cards(props.card.oracle_id, 'mainboard', 'considering', 1);
						} else {
							deck.remove_cards(props.card.oracle_id, 'mainboard', 1);
						}
						return;
					}
					if (counts.sideboard > 1) {
						deck.remove_cards(props.card.oracle_id, 'sideboard', 1);
						return;
					}
					if (counts.sideboard === 1) {
						if (counts.considering === 0) {
							deck.move_cards(props.card.oracle_id, 'sideboard', 'considering', 1);
						} else {
							deck.remove_cards(props.card.oracle_id, 'sideboard', 1);
						}
						return;
					}
					deck.remove_cards(props.card.oracle_id, 'considering', 1);
				}}
			>
				-
			</Button>
			{#if counts.considering > 0}
				<span
					class="flex h-10 w-10 items-center justify-center border-2 border-primary text-primary"
					>{counts.considering}</span
				>
			{/if}
			{#if counts.sideboard > 0}
				<span
					class="flex h-10 w-10 items-center justify-center border-2 border-secondary text-secondary"
					>{counts.sideboard}</span
				>
			{/if}
			{#if counts.mainboard > 0}
				<span
					class="flex h-10 w-10 items-center justify-center border-2 border-foreground text-foreground"
					>{counts.mainboard}</span
				>
			{/if}
			{#if counts.commander > 0}
				<span class="flex h-10 w-10 items-center justify-center border-foreground text-foreground"
					>C</span
				>
			{/if}
		{/if}
		<Button
			onclick={() => {
				if (props.zone === 'commander' && counts.considering > 0) {
					deck.move_cards(props.card.oracle_id, 'considering', 'commander', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.sideboard > 0) {
					deck.move_cards(props.card.oracle_id, 'sideboard', 'mainboard', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.considering > 0) {
					deck.move_cards(props.card.oracle_id, 'considering', 'mainboard', 1);
					return;
				}
				if (props.zone === 'sideboard' && counts.considering > 0) {
					deck.move_cards(props.card.oracle_id, 'considering', 'sideboard', 1);
					return;
				}

				deck.add_cards(props.card.oracle_id, props.print.scryfall_id, props.zone, 1);
			}}>+</Button
		>
	</div>
	<Card {...props} />
</div>
