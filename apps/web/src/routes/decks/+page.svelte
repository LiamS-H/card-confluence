<script lang="ts">
	import { yjs_client } from '$lib/decks/client';
	import { useDecks } from '$lib/decks/use-decks.svelte';

	const decks = useDecks();
</script>

<button
	onclick={() => {
		yjs_client.create_deck();
	}}>New</button
>

{#each decks.ids as id (id)}
	<ul>
		<li>
			<p>{id}</p>
		</li>
	</ul>
{/each}
