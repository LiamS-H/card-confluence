<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import type { NormalizedItem, NormalizedTag, NormalizedView } from '$lib/editor/display';
	import { use_settings } from '$lib/settings';
	import type { UUIDString } from '$lib/utils/uuid';
	import ViewTag from './view-tag.svelte';
	import { TagQuery } from '$lib/editor';

	const {
		cards,
		view,
		width,
		zone
	}: { cards: OracleCardSerialized[]; view: NormalizedView; width: number; zone: DeckZone } =
		$props();

	const {
		cards: { deckVariant: variant }
	} = $derived(use_settings());

	// Collect included oracle_ids across all tags so we can derive the unmatched set.
	// This runs in the parent (not in ViewTag) because showUnmatched is a view-level concern.
	const included_oracle_ids = $derived.by(() => {
		const included = new Set<UUIDString>();
		function scan_tag(item: NormalizedTag) {
			if (!(item.viewTag instanceof TagQuery)) {
				return;
			}
			if (!item.viewTag.data.response.loading && !item.viewTag.data.response.error) {
				for (const card of cards) {
					if (item.viewTag.matches(card)) included.add(card.oracle_id as UUIDString);
				}
			}
		}
		for (const item of view.items) {
			if (item.type === 'group') {
				for (const tag of item.tags) scan_tag(tag);
			} else {
				scan_tag(item);
			}
		}
		return included;
	});

	const unmatched_cards = $derived(
		view.settings.showUnmatched
			? cards.filter((c) => !included_oracle_ids.has(c.oracle_id as UUIDString))
			: []
	);

	const unmatched_tag: NormalizedTag = {
		type: 'virtual-tag',
		id: ':unmatched',
		tag: { object: 'virtual-tag', label: 'unmatched', scope: null },
		// Unmatched uses a pass-through predicate; cards are pre-filtered by the parent
		viewTag: {
			tag: { object: 'virtual-tag', label: 'unmatched', scope: null },
			matches: () => true
		}
	};

	function should_show(item: NormalizedItem): boolean {
		if (view.settings.showEmpty) return true;
		if (item.type === 'group') return item.tags.length > 0;
		return true; // ViewTag handles its own empty filtering
	}
</script>

<div
	style={variant !== 'img-full' ? `columns: ${width}px` : undefined}
	class={variant === 'img-full' ? 'flex max-w-full flex-wrap' : ''}
>
	{#each view.items.filter(should_show) as item (item.id)}
		<div class="relative flex break-inside-avoid flex-col overflow-y-hidden bg-background">
			{#if item.type === 'group'}
				<span>{item.group.label}</span>
				<div class="flex flex-col">
					{#each item.tags as tag (tag.id)}
						<ViewTag {tag} {cards} showEmpty={view.settings.showEmpty} {variant} {width} {zone} />
					{/each}
				</div>
			{:else}
				<ViewTag tag={item} {cards} showEmpty={view.settings.showEmpty} {variant} {width} {zone} />
			{/if}
		</div>
	{/each}

	{#if view.settings.showUnmatched && unmatched_cards.length > 0}
		<div class="relative flex break-inside-avoid flex-col overflow-y-hidden bg-background">
			<ViewTag
				tag={unmatched_tag}
				cards={unmatched_cards}
				showEmpty={false}
				{variant}
				{width}
				{zone}
			/>
		</div>
	{/if}
</div>
