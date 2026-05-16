<script lang="ts">
	import { use_deck_yjs } from '$lib';
	import { error } from '@sveltejs/kit';
	import { page } from '$app/state';
	import Editor from '$components/editor/editor.svelte';

	const id = page.params.deck_id;
	if (!id) {
		error(404, 'Not Found T');
	}

	const result = use_deck_yjs(() => id);
</script>

{#if result.deck.error !== null}
	<span>{result.deck.error}</span>
{:else}
	<Editor deck={result.deck.deck} />
{/if}
