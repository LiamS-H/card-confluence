<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import View from './view.svelte';

	const deck = use_deck_cards();

	const width = $state(200);

	const view: string | null = $state(deck.doc_state.parsed.views[0] ?? null);
</script>

<div class="flex w-full flex-col gap-2">
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
