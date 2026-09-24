<script lang="ts">
	import { onMount } from 'svelte';

	const { message }: { message: string } = $props();
	onMount(() => {
		console.error('[card]', message);
	});
</script>

<div class="w-ful flex h-full items-center justify-center">
	<p>Error: {message}</p>
</div>
