<script lang="ts">
	import { use_query } from '$lib';
	import { query_client } from '$lib/query/client.svelte';
	import Card from '$components/card.svelte';
	import VirtualList from 'svelte-tiny-virtual-list';
	import Search from '$components/search.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

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
		<VirtualList
			height={600}
			width="100%"
			itemCount={response.result.rows.length}
			itemSize={120}
			overscanCount={10}
		>
			<div slot="item" let:index let:style {style}>
				<Card id={response.result.rows[index].oracle_id} debounce={50} />
			</div>
		</VirtualList>
	</div>
{/if}
