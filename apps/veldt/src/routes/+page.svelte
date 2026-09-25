<script lang="ts">
	import { use_query } from '$lib';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ResultCard } from '$components/card';
	import Search from '$components/query/query-doc.svelte';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import { CardDialog } from '$components/card-dialog';
	import { use_settings } from '$lib/settings';

	let query = $derived(page.url.searchParams.get('q') ?? '');
	let active_card_id = $derived(page.url.searchParams.get('card') ?? null);
	let active_print_id = $derived(page.url.searchParams.get('print') ?? null);

	function onDocChange(new_query: string) {
		const params = new URL(page.url).searchParams;

		if (new_query) {
			params.set('q', new_query);
		} else {
			params.delete('q');
		}

		goto(resolve(`/?${params.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);

	let card_columns = $state(4);

	const {
		cards: { searchVariant: variant }
	} = use_settings();
</script>

<CardDialog
	oracle_id={active_card_id}
	print_id={active_print_id}
	on_close={() => {
		const params = new URL(page.url).searchParams;
		params.delete('card');
		params.delete('print');
		goto(resolve(`/?${params.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}}
/>

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

		{#if !response.loading && !response.error}{/if}
	</div>
	{#if !response.loading && !response.error}
		<div class="relative h-full flex-1">
			<VirtualGrid
				itemHeight={variant === 'img-full' ? undefined : 40}
				items={response.result.rows}
				columns={card_columns}
				overscan={10}
			>
				{#snippet item({ viewportRow, col, item })}
					<div class="p-1">
						<ResultCard {variant} result={item} key={`${viewportRow}-${col}`} width="100%" />
					</div>
				{/snippet}
			</VirtualGrid>
		</div>
	{/if}
</div>
