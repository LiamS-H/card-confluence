<script lang="ts">
	import { use_query } from '$lib';
	import { type QueryResultRow } from '$lib';
	import RowResult from '$components/query/row-result.svelte';
	import Search from '$components/query/query-doc.svelte';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import { Button } from '$components/ui/button';
	import DeckSearchCard from '$components/editor/deck-card.svelte';
	import type { DeckZone } from '@repo/schema-sync';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { get_veldt_settings } from '$lib/settings.svelte';

	const { doc_parsed } = use_deck_cards();

	const {
		cards: { variant }
	} = get_veldt_settings();

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
			replaceState: true
		});
	}
	const query = $derived(doc_parsed.domain + ' ' + search_query);
	let data = use_query(() => ({ query }), 500);
	$effect(() => {
		const query = doc_parsed.domain + ' ' + (page.url.searchParams.get('q') ?? '');
		console.log('querying now', query);
		data.query_now({ query });
	});
	const { response } = $derived(data);

	let card_columns = $state(4);
	const add_zones: DeckZone[] = ['considering', 'mainboard', 'sideboard'];
	let add_zone_index = $state(0);
	let zone: DeckZone = $derived(add_zones[add_zone_index]);
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
				itemHeight={variant === 'img' ? undefined : 40}
				items={response.result.rows}
				columns={card_columns}
				overscan={10}
			>
				{#snippet item({ index, viewportRow, col })}
					<div class={`${variant === 'img' ? 'p-1' : 'px-1'}`}>
						<RowResult
							result={response.result.rows[index] as QueryResultRow}
							key={`${viewportRow}-${col}`}
						>
							{#snippet children({ card, print, width })}
								<DeckSearchCard {card} {print} {width} {zone} />
							{/snippet}
						</RowResult>
					</div>
				{/snippet}
			</VirtualGrid>
		</div>
	{/if}
</div>
