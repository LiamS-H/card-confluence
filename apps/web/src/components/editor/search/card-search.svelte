<script lang="ts">
	import { use_query } from '$lib';
	import { query_client, type QueryResultRow } from '$lib';
	import RowResult from '$components/query/row-result.svelte';
	import Search from '$components/query/query-doc.svelte';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import Button from '$components/button.svelte';
	import DeckSearchCard from '$components/editor/deck-card.svelte';
	import type { DeckZone } from '@repo/schema-sync';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let query = $derived(page.url.searchParams.get('q') ?? '');

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
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);

	let card_columns = $state(4);
	const add_zones: DeckZone[] = ['considering', 'mainboard', 'sideboard'];
	let add_zone_index = $state(0);
	let zone: DeckZone = $derived(add_zones[add_zone_index]);
</script>

<div class="flex h-full flex-col gap-2 pt-2">
	<Search doc={query} {onDocChange} />
	<div class="sticky flex justify-between">
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
		<Button
			onclick={() => (add_zone_index = (add_zone_index + 1) % add_zones.length)}
			size="sm"
			intent={(['primary', 'default', 'secondary'] as const)[add_zone_index]}
		>
			{zone}
		</Button>
		<div class="flex w-fit items-center border-2 border-secondary text-secondary *:-m-px">
			<span class="px-2">local data</span>
			<Button
				size="sm"
				variant="full"
				intent="secondary"
				disabled={query_client.db_status !== 'synced'}
				onclick={() => {
					query_client.update_db_latest();
				}}>{query_client.db_status === 'synced' ? 'update' : query_client.db_status}</Button
			>
		</div>

		{#if !response.loading && !response.error}{/if}
	</div>
	{#if !response.loading && !response.error}
		<div class="relative flex-1">
			<VirtualGrid items={response.result.rows} columns={card_columns} overscan={10}>
				{#snippet item({ index, row, col })}
					<div class="p-1">
						<RowResult result={response.result.rows[index] as QueryResultRow} key={`${row}-${col}`}>
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
