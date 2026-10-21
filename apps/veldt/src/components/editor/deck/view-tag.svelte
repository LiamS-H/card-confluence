<script lang="ts" module>
	let active: string | null = $state(null);
</script>

<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import { ResultCard } from '$components/card';
	import CardOptionsDeck from '../card-options-deck.svelte';
	import { string_to_uuid } from '$lib/utils/uuid';
	import type { NormalizedTag } from '$lib/editor/display';
	import type { TagQuery } from '$lib/editor';

	const {
		tag,
		cards: all_cards,
		showEmpty,
		variant,
		width,
		zone
	}: {
		tag: NormalizedTag;
		cards: OracleCardSerialized[];
		showEmpty: boolean;
		variant: string;
		width: number;
		zone: DeckZone;
	} = $props();

	// Resolve cards reactively from the viewTag.
	// For TagQuery, this tracks matchedIds (a SvelteMap), so it re-derives on query response.
	// For virtual tags (TagManual/TagManualPredicate), matches() calls query_client reactively.
	const resolved = $derived.by(() => {
		const tq = tag.viewTag as TagQuery;
		const loading = !!(tq.data?.response?.loading);

		const matched = loading
			? []
			: all_cards.filter((c) => tag.viewTag.matches(c));

		return { cards: matched, loading };
	});

	const visible_cards = $derived(
		showEmpty || resolved.cards.length > 0 ? resolved.cards : []
	);

	const should_render = $derived(showEmpty || resolved.loading || visible_cards.length > 0);
</script>

{#if should_render}
	<span>{tag.tag.label} ({resolved.loading ? '…' : resolved.cards.length})</span>
	{#if resolved.loading}
		<div class="animate-pulse space-y-1 p-1">
			{#each { length: 3 } as _}
				<div class="h-5 w-full rounded bg-muted"></div>
			{/each}
		</div>
	{:else if variant === 'img-full'}
		<div class="flex max-w-full flex-wrap">
			{#each visible_cards.toReversed() as deck_card (deck_card.oracle_id)}
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
						<CardOptionsDeck {variant} {card} {print} {zone} />
					{/snippet}
				</ResultCard>
			{/each}
		</div>
	{:else if variant === 'tile'}
		<div class="flex w-fit flex-col -space-y-0.5">
			{#each visible_cards.toReversed() as deck_card (deck_card.oracle_id)}
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
						<CardOptionsDeck {variant} {card} {print} {zone} />
					{/snippet}
				</ResultCard>
			{/each}
		</div>
	{:else if variant === 'img'}
		<div class="flex w-fit flex-col">
			{const ids = visible_cards.map(
				// scope is null when the tag is virtual — use ':' as a separator that won't clash
				(deck_card) => `${tag.tag.scope ?? ':'}:${tag.tag.label}${deck_card.oracle_id}`
			)}
			{const has_active = $derived(ids.includes(active ?? ''))}
			{#each visible_cards as deck_card, index (deck_card.oracle_id)}
				{const id = $derived(ids[index])}
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
						<CardOptionsDeck {variant} {card} {print} {zone} />
					{/snippet}
				</ResultCard>
			{/each}
			<div style:height={has_active ? '0px' : `${(width * 7) / 5 - 0.15 * width}px`}></div>
		</div>
	{/if}
{/if}
