<script lang="ts">
	import { use_query } from '$lib';

	let query = $state('t:instant cmc=0');
	let { response } = $derived(use_query(() => ({ query })));
</script>

<h1>CC</h1>
<button
	onclick={async () => {
		query = 'test';
	}}>test</button
>
{#if response.loading}
	<p>Loading...</p>
{:else if response.error}
	<p>Error: {response.message}</p>
{:else}
	<p>Size: {response.data.byteLength}</p>
{/if}
