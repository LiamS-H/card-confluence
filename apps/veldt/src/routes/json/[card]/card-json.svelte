<script lang="ts">
	import type { DetailedCard } from '$lib';
	import { card_as_json } from '$lib/card-confluence/utils';

	const { card }: { card: DetailedCard } = $props();

	const json = $derived(card_as_json(card));
</script>

<div class="max-w-[calc(100svw-16px)] overflow-auto overflow-x-scroll">
	<!-- <div class="max-h-svh max-w-svw overflow-auto"> -->
	<pre class="max-w-[ca]">{json}</pre>
</div>
