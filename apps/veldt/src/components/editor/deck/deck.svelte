<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { Button } from '$components/ui/button';
	import View from './view.svelte';
	import { use_settings } from '$lib/settings';
	import { get_hovered_card } from '$lib/hover.svelte';
	import { ResultCard } from '$components/card';
	import { followCursor } from '$lib/actions/follor-cursor';

	const deck = use_deck_cards();

	let index = $state(0);
	const view: string | null = $derived(deck.doc_state.parsed.views[index] ?? null);

	const {
		cards: { deckVariant }
	} = $derived(use_settings());
	const deckVariants = ['img', 'img-full', 'tile'] as const;
	let deckVariantIndex = $derived(deckVariants.indexOf(deckVariant));
	const width = $derived(deckVariant === 'tile' ? 250 : 200);

	const { hovered } = $derived(get_hovered_card());
</script>

<div class="flex w-full flex-col gap-2">
	<div class="flex w-full">
		<!-- TODO: convert to dropdown component -->
		<!-- might also be a good idea to lift this state so that is can be rendered just right of the tabs -->
		<Button onclick={() => (index = (index + 1) % deck.doc_state.parsed.views.length)}
			>View: {view}</Button
		>

		<Button
			onclick={() => {
				const new_index = (deckVariantIndex + 1) % deckVariants.length;
				const new_variant = deckVariants[new_index];
				//TODO: actually update the decks variant setting
			}}>Cards {deckVariant}</Button
		>
	</div>
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
</div>
