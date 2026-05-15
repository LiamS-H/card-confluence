<script lang="ts">
	import { resolve } from '$app/paths';
	import { use_deck_meta } from '$lib/sync/use-deck.svelte';
	import Button from './button.svelte';

	const { id, edit }: { id: string; edit: boolean } = $props();

	const { deck, delete_deck } = use_deck_meta(() => id);
</script>

{#if deck.error !== null}
	<div>
		<span> Deck not found. </span>
	</div>
{:else}
	<div>
		<a href={resolve(`/decks/guest/${id}${edit ? '/edit' : ''}`)}>
			{deck.deck.title || 'Untitled Deck'}
		</a>
		<Button intent="destructive" onclick={delete_deck}>delete</Button>
	</div>
{/if}
