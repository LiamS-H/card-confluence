<script lang="ts">
	import { use_query } from '$lib';
	import { query_client, type QueryResultRow } from '$lib/query/client.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Result from '$components/query/row-result.svelte';
	import Search from '$components/query/search.svelte';
	import VirtualGrid from '$components/virtual-grid.svelte';

	let query = $derived(page.url.searchParams.get('q') ?? '');

	function onDocChange(new_query: string) {
		const params = new URL(page.url).searchParams;

		if (new_query) {
			params.set('q', new_query);
		} else {
			params.delete('q');
		}

		// Update the URL silently
		goto(resolve(`/?${params.toString()}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);
</script>

<button
	onclick={() => {
		query_client.update_db_latest();
	}}>RefetchDB</button
>

<h1>CC</h1>

<Search doc={query} {onDocChange} />

{#if response.loading}
	<p>Loading...</p>
{:else if response.error}
	<p>Error: {response.message}</p>
{:else}
	<p>{response.result.rows.length}</p>
	<div>
		<VirtualGrid
			items={response.result.rows}
			height={600}
			width="100%"
			itemHeight={280 + 8}
			itemWidth={200 + 8}
			overscan={10}
		>
			{#snippet item({ index, row, col })}
				<div class="p-1">
					<Result result={response.result.rows[index] as QueryResultRow} key={`${row}-${col}`} />
				</div>
			{/snippet}
		</VirtualGrid>
	</div>
{/if}
