<script lang="ts">
	import { Button } from '$components/ui/button';
	import type { CardVariant } from '$lib/settings/settings-local.svelte';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { uuid_to_string } from '$lib/utils/uuid';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';

	const props: {
		card: CardObj;
		print: Print;
		zone: DeckZone;
		variant: CardVariant;
	} = $props();
	const deck = use_deck_cards();

	const oracle_id = $derived(uuid_to_string(props.card.oracle_id));
	const scryfall_id = $derived(uuid_to_string(props.print.scryfall_id));
	const counts = $derived(deck.get_card_counts(oracle_id));
	const mult_in_singleton = $derived(
		props.card.otags.includes('singleton-breaker') || props.card.super_types.includes('basic')
	);

	const toggle_mode = $derived(deck.settings.singleton && !mult_in_singleton);

	const is_image = $derived(props.variant === 'img-full');
	const button_size = $derived(is_image ? 'md' : 'xs');
</script>

<div class="flex bg-background">
	{#if counts.total > 0}
		<Button
			size={button_size}
			intent="destructive"
			onclick={() => {
				if (counts.commander > 1) {
					deck.mutate.remove_cards(oracle_id, 'commander', 1);
					return;
				}
				if (counts.commander === 1) {
					if (counts.mainboard === 0) {
						deck.mutate.move_cards(oracle_id, 'commander', 'mainboard', 1);
					} else {
						deck.mutate.remove_cards(oracle_id, 'commander', 1);
					}
					return;
				}
				if (counts.mainboard > 1) {
					deck.mutate.remove_cards(oracle_id, 'mainboard', 1);
					return;
				}
				if (counts.mainboard === 1) {
					if (counts.considering === 0) {
						deck.mutate.move_cards(oracle_id, 'mainboard', 'considering', 1);
					} else {
						deck.mutate.remove_cards(oracle_id, 'mainboard', 1);
					}
					return;
				}
				if (counts.sideboard > 1) {
					deck.mutate.remove_cards(oracle_id, 'sideboard', 1);
					return;
				}
				if (counts.sideboard === 1) {
					if (counts.considering === 0) {
						deck.mutate.move_cards(oracle_id, 'sideboard', 'considering', 1);
					} else {
						deck.mutate.remove_cards(oracle_id, 'sideboard', 1);
					}
					return;
				}
				deck.mutate.remove_cards(oracle_id, 'considering', 1);
			}}
		>
			-
		</Button>
	{/if}
	{#if !toggle_mode || counts[props.zone] !== 1 || counts.total !== 1}
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
		<Button
			size={button_size}
			onclick={() => {
				if (props.zone === 'commander' && counts.considering > 0) {
					deck.mutate.move_cards(oracle_id, 'considering', 'commander', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.sideboard > 0) {
					deck.mutate.move_cards(oracle_id, 'sideboard', 'mainboard', 1);
					return;
				}
				if (props.zone === 'mainboard' && counts.considering > 0) {
					deck.mutate.move_cards(oracle_id, 'considering', 'mainboard', 1);
					return;
				}
				if (props.zone === 'sideboard' && counts.considering > 0) {
					deck.mutate.move_cards(oracle_id, 'considering', 'sideboard', 1);
					return;
				}

				if (props.zone === 'considering' && counts.considering > 0 && counts.mainboard < 1) {
					deck.mutate.move_cards(oracle_id, 'considering', 'mainboard', 1);
					return;
				}

				if (props.zone === 'considering' && counts.mainboard > 0 && counts.considering < 1) {
					deck.mutate.add_cards(oracle_id, scryfall_id, 'mainboard', 1);
					return;
				}

				deck.mutate.add_cards(oracle_id, scryfall_id, props.zone, 1);
			}}
		>
			+
		</Button>
	{/if}
</div>
