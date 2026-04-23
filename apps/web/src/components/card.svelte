<script lang="ts">
	import { query_client } from '$lib/query/client';
	import type { Card } from 'wasm-browser';

	const { id }: { id: string } = $props();

	const card = $derived(query_client.cards.get(id) as Card);
</script>

<div>
	<span>{card.name}</span>
	<p>{card.oracle_text}</p>
</div>
