<script lang="ts">
	import { use_query } from '$lib';
	import { query_client } from '$lib/query/client';
	import Card from '../components/card.svelte';
	import VirtualList from 'svelte-tiny-virtual-list';

	let query = $state('t:instant cmc=0');
	let { response } = $derived(use_query(() => ({ query })));
</script>

<button
	onclick={() => {
		query_client.update_db_latest();
	}}>RefetchDB</button
>

<h1>CC</h1>
<textarea bind:value={query}></textarea>

{#if response.loading}
	<p>Loading...</p>
{:else if response.error}
	<p>Error: {response.message}</p>
{:else}
	<p>{response.result.rows.length}</p>
	<div>
		<VirtualList height={600} width="100%" itemCount={response.result.rows.length} itemSize={120}>
			<div slot="item" let:index let:style {style}>
				<Card id={response.result.rows[index].oracle_id} />
			</div>
		</VirtualList>
	</div>
{/if}
