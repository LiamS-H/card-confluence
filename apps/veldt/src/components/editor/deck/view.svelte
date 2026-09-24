<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import type { View } from 'codemirror-lang-veldt-deck';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { ResultCard } from '$components/card';
	import CardOptionsDeck from '../card-options-deck.svelte';
	import ConsideringOptions from './considering-options.svelte';

	const {
		cards,
		view,
		width,
		zone
	}: { cards: OracleCardSerialized[]; view: View; width: number; zone: DeckZone } = $props();

	const { doc_state } = use_deck_cards();

	const tags = $derived.by(() => {
		if (!view) return [];
		const out = [];
		for (const key of view.children) {
			const obj = doc_state.parsed.objects.get(key);
			if (!obj) continue;
			if (obj.object === 'tag') {
				const fetched = doc_state.tags_fetched.get(key);
				if (!fetched) continue;
				const filtered = cards.filter((c) => fetched.matchedIds.has(c.oracle_id));
				if (filtered.length === 0) continue;
				out.push({
					id: key,
					tag: obj,
					cards: filtered
				});
			}
		}
		return out;
	});
</script>

<div style={`columns: ${width}px`}>
	{#each tags as tag}
		<div class="flex w-fit break-inside-avoid flex-col">
			<span>{tag.tag.label}</span>
			<div class="flex w-fit flex-col">
				{#each tag.cards as deck_card (deck_card.oracle_id)}
					<ResultCard
						{width}
						result={{
							matched_prints: [deck_card.instances[0].scryfall_id],
							oracle_id: deck_card.oracle_id
						}}
						key={deck_card.oracle_id}
					>
						{#snippet options({ card, print })}
							{#if zone === 'considering'}
								<ConsideringOptions {card} {print} />
							{:else}
								<CardOptionsDeck {card} {print} {zone} />
							{/if}
						{/snippet}
					</ResultCard>
				{/each}
			</div>
		</div>
	{/each}
</div>
