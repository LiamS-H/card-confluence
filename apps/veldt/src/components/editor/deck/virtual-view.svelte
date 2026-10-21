<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import type { VirtualTag } from 'codemirror-lang-veldt-deck';
	import { use_settings } from '$lib/settings';
	import ViewTagComp from './view-tag.svelte';
	import type { UUIDString } from '$lib/utils/uuid';
	import { use_deck_edit, type ViewTag, type VirtualView } from '$lib/editor';

	const {
		cards,
		view,
		width,
		zone
	}: { cards: OracleCardSerialized[]; view: VirtualView; width: number; zone: DeckZone } = $props();

	const deck = use_deck_edit();

	type DisplayTag = {
		// A virtual tag does not apear in the tag document
		type: 'virtual-tag';
		tag: VirtualTag;
		cards: OracleCardSerialized[];
	};

	const display_items = $derived.by(() => {
		const included_cards = new Set();
		const out: DisplayTag[] = [];
		function tag_to_display(tag: ViewTag, key: string): DisplayTag {
			const filtered = cards.filter((c) => {
				const out = tag.matches(c);
				if (out) {
					included_cards.add(c.oracle_id);
				}
				return out;
			});
			return {
				type: 'virtual-tag',
				tag: tag.tag as VirtualTag,
				cards: filtered
			};
		}
		for (const tag of view.tags) {
			out.push(tag_to_display(tag, tag.tag.label));
		}

		if (view.settings.showUnmatched) {
			const filtered = cards.filter((c) => !included_cards.has(c.oracle_id as UUIDString));
			out.push({
				type: 'virtual-tag',
				tag: { object: 'virtual-tag', label: 'unmatched', scope: null },
				cards: filtered
			});
		}

		if (!view.settings.showEmpty) {
			return out.filter((obj) => obj.cards.length !== 0);
		}
		return out;
	});

	const {
		cards: { deckVariant: variant }
	} = $derived(use_settings());
</script>

<div
	style={variant !== 'img-full' ? `columns: ${width}px` : undefined}
	class={variant === 'img-full' ? 'flex max-w-full flex-wrap' : ''}
>
	{#each display_items as item}
		<div class="relative flex break-inside-avoid flex-col overflow-y-hidden bg-background">
			<ViewTagComp tag={item} {variant} {width} {zone} />
		</div>
	{/each}
</div>
