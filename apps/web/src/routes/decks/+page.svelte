<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$components/button.svelte';
	import DeckCard from '$components/deck-card.svelte';
	import { sync_client } from '$lib/sync/client';
	import { use_decks } from '$lib';

	const decks = use_decks();
</script>

<Button
	onclick={() => {
		const id = sync_client.create_deck();
		goto(resolve(`/decks/guest/${id}/edit`));
		// redirect to new_deck
	}}>New</Button
>

{#each decks.ids as id (id)}
	<ul>
		<li>
			<DeckCard {id} edit />
		</li>
	</ul>
{/each}
