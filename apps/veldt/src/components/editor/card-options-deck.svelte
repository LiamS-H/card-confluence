<script lang="ts">
	import { Button } from '$components/ui/button';
	import { use_settings } from '$lib/settings';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';

	const props: {
		card: CardObj;
		print: Print;
		zone: DeckZone;
	} = $props();
	const deck = use_deck_cards();
	const counts = $derived(deck.get_card_counts(props.card.oracle_id));
	const mult_in_singleton = $derived(
		props.card.otags.includes('singleton-breaker') || props.card.super_types.includes('basic')
	);

	const toggle_mode = $derived(deck.settings.singleton && !mult_in_singleton);

	const {
		cards: { deckVariant: variant }
	} = use_settings();
</script>

<div class="flex">
	{#if counts.total > 0}
		<Button
			size={variant === 'img' ? 'md' : 'xs'}
			intent="destructive"
			onclick={() => {
				if (counts.commander > 1) {
					deck.mutate.remove_cards(props.card.oracle_id, 'commander', 1);
					return;
				}
				if (counts.commander === 1) {
					if (counts.mainboard === 0) {
						deck.mutate.move_cards(props.card.oracle_id, 'commander', 'mainboard', 1);
					} else {
						deck.mutate.remove_cards(props.card.oracle_id, 'commander', 1);
					}
					return;
				}
				if (counts.mainboard > 1) {
					deck.mutate.remove_cards(props.card.oracle_id, 'mainboard', 1);
					return;
				}
				if (counts.mainboard === 1) {
					if (counts.considering === 0) {
						deck.mutate.move_cards(props.card.oracle_id, 'mainboard', 'considering', 1);
					} else {
						deck.mutate.remove_cards(props.card.oracle_id, 'mainboard', 1);
					}
					return;
				}
				if (counts.sideboard > 1) {
					deck.mutate.remove_cards(props.card.oracle_id, 'sideboard', 1);
					return;
				}
				if (counts.sideboard === 1) {
					if (counts.considering === 0) {
						deck.mutate.move_cards(props.card.oracle_id, 'sideboard', 'considering', 1);
					} else {
						deck.mutate.remove_cards(props.card.oracle_id, 'sideboard', 1);
					}
					return;
				}
				deck.mutate.remove_cards(props.card.oracle_id, 'considering', 1);
			}}
		>
			-
		</Button>
		{const is_image = variant === 'img'}
		{#if counts.considering > 0}
			<span
				class={`flex ${is_image ? 'h-10 w-10' : 'h-7 w-7'} items-center justify-center border-2 border-primary text-primary`}
				>{counts.considering}</span
			>
		{/if}
		{#if counts.sideboard > 0}
			<span
				class={`flex ${is_image ? 'h-10 w-10' : 'h-7 w-7'} items-center justify-center border-2 border-secondary text-secondary`}
				>{counts.sideboard}</span
			>
		{/if}
		{#if counts.mainboard > 0}
			<span
				class={`flex ${is_image ? 'h-10 w-10' : 'h-7 w-7'} items-center justify-center border-2 border-foreground text-foreground`}
				>{counts.mainboard}</span
			>
		{/if}
		{#if counts.commander > 0}
			<span
				class={`flex ${is_image ? 'h-10 w-10' : 'h-7 w-7'} items-center justify-center border-2 border-foreground text-foreground`}
				>C</span
			>
		{/if}
	{/if}
	{#if !toggle_mode || counts[props.zone] !== 1 || counts.total !== 1}
		<Button
			size={variant === 'img' ? 'md' : 'xs'}
			onclick={() => {
				if (props.zone === 'commander' && counts.considering > 0) {
					deck.mutate.move_cards(props.card.oracle_id, 'considering', 'commander', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.sideboard > 0) {
					deck.mutate.move_cards(props.card.oracle_id, 'sideboard', 'mainboard', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.considering > 0) {
					deck.mutate.move_cards(props.card.oracle_id, 'considering', 'mainboard', 1);
					return;
				}
				if (props.zone === 'sideboard' && counts.considering > 0) {
					deck.mutate.move_cards(props.card.oracle_id, 'considering', 'sideboard', 1);
					return;
				}

				if (props.zone === 'considering' && counts.considering > 0 && counts.mainboard < 1) {
					deck.mutate.move_cards(props.card.oracle_id, 'considering', 'mainboard', 1);
					return;
				}

				if (props.zone === 'considering' && counts.mainboard > 0 && counts.considering < 1) {
					deck.mutate.add_cards(props.card.oracle_id, props.print.scryfall_id, 'mainboard', 1);
					return;
				}

				deck.mutate.add_cards(props.card.oracle_id, props.print.scryfall_id, props.zone, 1);
			}}
		>
			+
		</Button>
	{/if}
</div>
