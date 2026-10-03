<script lang="ts">
	import { use_query, type QueryResultRow } from '$lib';
	import Search from '$components/query/query-doc.svelte';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import { Button } from '$components/ui/button';
	import type { DeckZone } from '@repo/schema-sync';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { query_with_domain } from '$lib/utils';
	import { ResultCard } from '$components/card';
	import CardOptionsDeck from '../card-options-deck.svelte';
	import { use_settings } from '$lib/settings';

	const { doc_state, settings } = use_deck_cards();

	const {
		cards: { searchVariant: variant }
	} = use_settings();

	let search_query = $derived(page.url.searchParams.get('q') ?? '');

	function onDocChange(new_query: string) {
		const params = new URL(page.url).searchParams;

		if (new_query) {
			params.set('q', new_query);
		} else {
			params.delete('q');
		}

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}/?${params.toString()}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true,
			state: { from_search_box: true }
		});
	}
	const query = $derived(query_with_domain(doc_state.parsed, search_query));
	let data = use_query(() => ({ query }), 500);

	afterNavigate(() => {
		// skip navigations we triggered ourselves via onDocChange
		// @ts-expect-error
		if (page.state.from_search_box) return;

		const new_query = query_with_domain(doc_state.parsed, page.url.searchParams.get('q') ?? '');
		data.query_now({ query: new_query });
	});
	const { response } = $derived(data);

	let card_columns = $state(4);
	const add_zones: DeckZone[] = $derived(
		settings.sideboard ? ['considering', 'mainboard', 'sideboard'] : ['considering', 'mainboard']
	);

	let add_zone_index = $state(0);
	let zone: DeckZone = $derived(add_zones[add_zone_index % add_zones.length]);
</script>

<div class="flex h-full flex-col">
	<Search doc={search_query} {onDocChange} />
	<div class="sticky flex justify-between pt-px">
		<div class="flex items-center px-2">
			{#if response.loading}
				<p>Loading...</p>
			{:else if response.error}
				<p>Error: {response.message}</p>
			{:else}
				<p>{response.result.rows.length} cards</p>
			{/if}
		</div>
		<div class="flex flex-1 items-center px-2">
			<input
				class="w-full"
				id="native-slider"
				type="range"
				min="1"
				max="10"
				bind:value={card_columns}
			/>
		</div>

		<div class="flex w-fit items-center">
			<Button
				onclick={() => (add_zone_index = (add_zone_index + 1) % add_zones.length)}
				size="sm"
				variant="outline"
				intent={(['primary', 'default', 'secondary'] as const)[add_zone_index]}
			>
				+ to
				{zone}
			</Button>
		</div>

		{#if !response.loading && !response.error}{/if}
	</div>
	{#if !response.loading && !response.error}
		<div class="relative flex-1">
			<VirtualGrid
				itemHeight={variant === 'img-full' ? undefined : 40}
				length={response.result.rows.length}
				columns={card_columns}
				overscan={10}
			>
				{#snippet item({ index, viewportRow, col })}
					<div class={`${variant === 'img' ? 'p-1' : 'px-1'}`}>
						<ResultCard
							{variant}
							result={response.result.rows.at(index) as QueryResultRow}
							key={`${viewportRow}-${col}`}
							width="100%"
						>
							{#snippet options({ card, print, variant })}
								<CardOptionsDeck {card} {print} {variant} {zone} />
							{/snippet}
						</ResultCard>
					</div>
				{/snippet}
			</VirtualGrid>
		</div>
	{/if}
</div>
