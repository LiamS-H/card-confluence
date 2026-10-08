<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { uuid_to_string } from '$lib/utils/uuid';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { DeckZone } from '@repo/schema-sync';
	import * as Popover from '$components/ui/popover';
	import * as Card from '$components/ui/card';
	import CardOptionsFullZone from './card-options-full-zone.svelte';

	const props: {
		card: CardObj;
		print: Print;
	} = $props();
	const deck = use_deck_cards();

	const oracle_id = $derived(uuid_to_string(props.card.oracle_id));
	const scryfall_id = $derived(uuid_to_string(props.print.scryfall_id));
	const counts = $derived(deck.get_card_counts(oracle_id));

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

<Popover.Root>
	<Popover.Trigger intent="secondary">manage counts</Popover.Trigger>
	<Popover.Content class="w-fit ">
		<Card.Root intent="secondary">
			<Card.Body class="flex flex-col items-end gap-2">
				{#each zones as zone}
					<CardOptionsFullZone
						{zone}
						{oracle_id}
						{scryfall_id}
						count={counts[zone]}
					/>
				{/each}
			</Card.Body>
		</Card.Root>
	</Popover.Content>
</Popover.Root>
