<script lang="ts">
	import { use_query } from '$lib';
	import Card from '../components/card.svelte';
	import VirtualList from 'svelte-tiny-virtual-list';

	let query = $state('t:instant cmc=0');
	let { response } = $derived(use_query(() => ({ query }), 'main-query', 500));
</script>

<h1>CC</h1>
<textarea bind:value={query}></textarea>

{#if response.loading}
	<p>Loading...</p>
{:else if response.error}
	<p>Error: {response.message}</p>
{:else}
	<p>{response.ids.length}</p>
	<div>
		<VirtualList height={600} width="100%" itemCount={response.ids.length} itemSize={120}>
			<div slot="item" let:index let:style {style}>
				<Card id={response.ids[index] as string} key="main-query" debounce={30} />
			</div>
		</VirtualList>
	</div>
{/if}
