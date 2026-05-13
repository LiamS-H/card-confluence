<script lang="ts">
	import Button from '$components/button.svelte';
	import { sync_client } from '$lib/sync/client';
	import { useDecks } from '$lib/sync/use-decks.svelte';

	const decks = useDecks();
</script>

<Button
	onclick={() => {
		sync_client.create_deck();
	}}>New</Button
>

{#each decks.ids as id (id)}
	<ul>
		<li>
			<p>{id}</p>
		</li>
	</ul>
{/each}
