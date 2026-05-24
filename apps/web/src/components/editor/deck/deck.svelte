<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-cards.svelte';
	import RowResult from '$components/query/row-result.svelte';
	import ConsideringCard from '$components/editor/deck/considering-card.svelte';
	import DeckCard from '$components/editor/deck-card.svelte';

	const deck = use_deck_cards();
	const { main_deck, considering, sideboard } = $derived(deck);

	const width = $state(200);
</script>

<div class="flex flex-col gap-2">
	<div class="border-2 border-foreground">
		{#each main_deck as deck_card (deck_card.y_id)}
			<RowResult
				result={{ matched_prints: [deck_card.scryfall_id], oracle_id: deck_card.oracle_id }}
				key={deck_card.oracle_id}
			>
				{#snippet children({ card, print })}
					<DeckCard {card} {print} {width} zone="mainboard" />
				{/snippet}
			</RowResult>
		{/each}
	</div>

	<div class="border-2 border-foreground">
		{#each sideboard as deck_card (deck_card.y_id)}
			<RowResult
				result={{ matched_prints: [deck_card.scryfall_id], oracle_id: deck_card.oracle_id }}
				key={deck_card.oracle_id}
			>
				{#snippet children({ card, print })}
					<DeckCard {card} {print} {width} zone="sideboard" />
				{/snippet}
			</RowResult>
		{/each}
	</div>
	<div class="border-2 border-foreground">
		{#each considering as deck_card (deck_card.y_id)}
			<RowResult
				result={{ matched_prints: [deck_card.scryfall_id], oracle_id: deck_card.oracle_id }}
				key={deck_card.oracle_id}
			>
				{#snippet children({ card, print })}
					<ConsideringCard {card} {print} {width} />
				{/snippet}
			</RowResult>
		{/each}
	</div>
</div>
