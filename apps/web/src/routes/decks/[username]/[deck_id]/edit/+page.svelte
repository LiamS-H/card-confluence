<script lang="ts">
	import { use_deck } from '$lib/sync/use-deck.svelte';
	import { error } from '@sveltejs/kit';
	import { page } from '$app/state';

	import * as Y from 'yjs';

	const id = page.params.deck_id;
	if (!id) {
		error(404, 'Not Found T');
	}

	const { deck: _deck } = use_deck(() => id);
	if (_deck.error !== null) {
		error(404, _deck.error);
	}
	const { deck } = _deck;

	const text: Y.Text = deck.get('doc') as Y.Text;
	// hook up a codemirror doc to the yjs client using the yjs codemirror extension
</script>

<div>
	<span>
		{text.toJSON()}
	</span>
</div>
