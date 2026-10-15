<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import View from './view.svelte';
	import { use_settings } from '$lib/settings';
	import { get_hovered_card } from '$lib/hover.svelte';
	import { ResultCard } from '$components/card';
	import { followCursor } from '$lib/actions/follor-cursor';

	import ViewDropdown from './view-dropdown.svelte';

	const deck = use_deck_cards();

	const view = $derived(deck.doc_state.parsed.views[deck.active_view] ?? null);

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
	<div class="flex flex-col">
		<View
			zone="mainboard"
			{width}
			cards={deck.main_deck}
			view={deck.doc_state.parsed.objects.get(view) as any}
		/>
	</div>
	{#if deck.settings.sideboard}
		<div class="flex w-full flex-col">
			<div class="border-y-2 border-secondary text-secondary">
				<span>sideboard</span>
			</div>
			<View
				zone="sideboard"
				{width}
				cards={deck.sideboard}
				view={deck.doc_state.parsed.objects.get(view) as any}
			/>
		</div>
	{/if}
	<div class="flex w-full flex-col">
		<div class="w-full border-y-2 border-primary text-primary">
			<span>considering</span>
		</div>
		<View
			zone="considering"
			{width}
			cards={deck.considering}
			view={deck.doc_state.parsed.objects.get(view) as any}
		/>
	</div>
	<div class="h-1000"></div>
</div>
