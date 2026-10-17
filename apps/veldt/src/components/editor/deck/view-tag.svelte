<script lang="ts" module>
	let active: string | null = $state(null);
</script>

<script lang="ts">
	import type { DeckZone } from '@repo/schema-sync';
	import { ResultCard } from '$components/card';
	import CardOptionsDeck from '../card-options-deck.svelte';
	import { string_to_uuid } from '$lib/utils/uuid';
	import { type DisplayTag } from './view.svelte';

	const {
		tag,
		variant,
		width,
		zone
	}: {
		tag: DisplayTag;
		variant: string;
		width: number;
		zone: DeckZone;
	} = $props();
</script>

<span>{tag.tag.label} ({tag.cards.length})</span>
{#if variant === 'img-full'}
	<div class="flex max-w-full flex-wrap">
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
					<CardOptionsDeck {variant} {card} {print} {zone} />
				{/snippet}
			</ResultCard>
		{/each}
	</div>
{:else if variant === 'tile'}
	<div class="flex w-fit flex-col -space-y-0.5">
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
					<CardOptionsDeck {variant} {card} {print} {zone} />
				{/snippet}
			</ResultCard>
		{/each}
	</div>
{:else if variant === 'img'}
	<div class="flex w-fit flex-col">
		{const ids = tag.cards.map(
			// a scope like this souldn't clash with any real
			// the scope is null when the tag is virtual
			(deck_card) => `${tag.tag.scope ?? ':'}:${tag.tag.label}${deck_card.oracle_id}`
		)}
		{const has_active = $derived(ids.includes(active ?? ''))}
		{#each tag.cards as deck_card, index (deck_card.oracle_id)}
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
