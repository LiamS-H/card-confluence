<script lang="ts">
	import RowResult from '$components/query/row-result.svelte';
	import type { OracleCardSerialized } from '@repo/schema-sync';
	import type { View } from 'codemirror-lang-veldt-deck';
	import DeckCard from '../deck-card.svelte';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';

	const { cards, view, width }: { cards: OracleCardSerialized[]; view: View; width: number } =
		$props();

	const { tags_fetched, doc_parsed } = use_deck_cards();

	// $effect(() => {
	// 	console.log(view);
	// 	console.log(tags_fetched);
	// 	console.log(doc_parsed);
	// });

	// const view_flat = flattened(view)

	const tags = $derived.by(() => {
		if (!view) return [];
		const out = [];
		for (const key of view.children) {
			const obj = doc_parsed.objects.get(key);
			if (!obj) continue;
			if (obj.object === 'tag') {
				const fetched = tags_fetched.get(key);
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
					<RowResult
						result={{
							matched_prints: [deck_card.instances[0].scryfall_id],
							oracle_id: deck_card.oracle_id
						}}
						key={deck_card.oracle_id}
					>
						{#snippet children({ card, print })}
							<DeckCard {card} {print} {width} zone="mainboard" />
						{/snippet}
					</RowResult>
				{/each}
			</div>
		</div>
	{/each}
</div>
