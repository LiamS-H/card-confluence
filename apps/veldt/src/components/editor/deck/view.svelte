<script lang="ts" module>
	let active: string | null = $state(null);
</script>

<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import type { View } from 'codemirror-lang-veldt-deck';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { ResultCard } from '$components/card';
	import CardOptionsDeck from '../card-options-deck.svelte';
	import ConsideringOptions from './considering-options.svelte';
	import { use_settings } from '$lib/settings';
	import { string_to_uuid, type UUIDString } from '$lib/utils/uuid';

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
				const filtered = cards.filter((c) => {
					return fetched.matchedIds.has(c.oracle_id as UUIDString);
				});
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

	const {
		cards: { deckVariant: variant }
	} = use_settings();
</script>

<div style={`columns: ${width}px`}>
	{#each tags as tag}
		<div class="flex w-fit break-inside-avoid flex-col overflow-y-hidden">
			{#if variant === 'img-full'}
				<span>{tag.tag.label}</span>
				<div class="flex w-fit flex-col">
					{#each tag.cards.toReversed() as deck_card (deck_card.oracle_id)}
						<ResultCard
							{variant}
							{width}
							result={{
								matched_prints: string_to_uuid(deck_card.instances[0].scryfall_id) as Uint8Array,
								oracle_id: string_to_uuid(deck_card.oracle_id) as Uint8Array
							}}
							key={deck_card.oracle_id}
						>
							{#snippet options({ card, print })}
								{#if zone === 'considering'}
									<ConsideringOptions {card} {print} />
								{:else}
									<CardOptionsDeck {variant} {card} {print} {zone} />
								{/if}
							{/snippet}
						</ResultCard>
					{/each}
				</div>
			{:else if variant === 'tile'}
				<span>{tag.tag.label}</span>
				<div class="flex w-fit flex-col">
					{#each tag.cards.toReversed() as deck_card (deck_card.oracle_id)}
						<ResultCard
							{variant}
							{width}
							result={{
								matched_prints: string_to_uuid(deck_card.instances[0].scryfall_id) as Uint8Array,
								oracle_id: string_to_uuid(deck_card.oracle_id) as Uint8Array
							}}
							key={deck_card.oracle_id}
						>
							{#snippet options({ card, print })}
								{#if zone === 'considering'}
									<ConsideringOptions {card} {print} />
								{:else}
									<CardOptionsDeck {variant} {card} {print} {zone} />
								{/if}
							{/snippet}
						</ResultCard>
					{/each}
				</div>
			{:else if variant === 'img'}
				<span>{tag.tag.label}</span>
				<div class="flex w-fit flex-col">
					{#each tag.cards as deck_card (deck_card.oracle_id)}
						{const id = $derived(`${tag.tag.scope}:${tag.tag.label}${deck_card.oracle_id}`)}
						{const isActive = $derived(id === active)}
						<ResultCard
							onclick={isActive
								? undefined
								: () => {
										active = id;
									}}
							variant={isActive ? 'img-full' : 'img'}
							{width}
							result={{
								matched_prints: string_to_uuid(deck_card.instances[0].scryfall_id) as Uint8Array,
								oracle_id: string_to_uuid(deck_card.oracle_id) as Uint8Array
							}}
							key={deck_card.oracle_id}
						>
							{#snippet options({ card, print })}
								{#if zone === 'considering'}
									<ConsideringOptions {card} {print} />
								{:else}
									<CardOptionsDeck {variant} {card} {print} {zone} />
								{/if}
							{/snippet}
						</ResultCard>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
