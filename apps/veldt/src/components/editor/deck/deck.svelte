<script lang="ts">
	import { use_deck_edit } from '$lib/editor';
	import View from './view.svelte';
	import { use_settings } from '$lib/settings';
	import { get_hovered_card } from '$lib/hover.svelte';
	import { ResultCard } from '$components/card';
	import { followCursor } from '$lib/actions/follor-cursor';
	import ViewDropdown from './view-dropdown.svelte';
	import { normalize_doc_view, normalize_virtual_view } from '$lib/editor/display';

	const deck = use_deck_edit();

	const raw_view = $derived(deck.get_view(deck.active_view) ?? null);

	const view = $derived.by(() => {
		if (!raw_view) return null;
		if (raw_view.object === 'virtual-view') {
			return normalize_virtual_view(raw_view);
		}
		return normalize_doc_view(raw_view, deck.view_tags, deck.tag_doc);
	});

	const {
		cards: { deckVariant }
	} = $derived(use_settings());
	const deckVariants = ['img', 'img-full', 'tile'] as const;
	let deckVariantIndex = $derived(deckVariants.indexOf(deckVariant));
	const width = $derived(deckVariant === 'tile' ? 250 : 200);

	const { hovered } = $derived(get_hovered_card());
</script>

<div class="pointer-events-none absolute inset-y-0 z-10">
	<div class="sticky top-10 flex w-full pl-56">
		<ViewDropdown />
	</div>
</div>
<div class="flex w-full flex-col gap-2">
	{#if hovered && hovered.print && deckVariant === 'tile'}
		<div use:followCursor={15}>
			<ResultCard
				variant={'img-full'}
				{width}
				result={{ oracle_id: hovered.card, matched_prints: hovered.print }}
				options={null}
			/>
		</div>
	{/if}

	{#if view}
		<div class="flex flex-col">
			<View zone="mainboard" {width} cards={deck.cards.main_deck} {view} />
		</div>
		{#if deck.settings.sideboard}
			<div class="flex w-full flex-col">
				<div class="border-y-2 border-secondary text-secondary">
					<span>sideboard</span>
				</div>
				<View zone="sideboard" {width} cards={deck.cards.sideboard} {view} />
			</div>
		{/if}
		<div class="flex w-full flex-col">
			<div class="w-full border-y-2 border-primary text-primary">
				<span>considering</span>
			</div>
			<View zone="considering" {width} cards={deck.cards.considering} {view} />
		</div>
	{/if}

	<div class="h-full"></div>
</div>
