<script lang="ts">
	import { onMount } from 'svelte';

	const { message }: { message: string } = $props();
	onMount(() => {
		console.error('[card]', message);
	});
</script>

<p>Error: {message}</p>
