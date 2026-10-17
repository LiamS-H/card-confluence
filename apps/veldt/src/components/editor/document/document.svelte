<script lang="ts">
	import { TagDoc } from '$components/tag-doc';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import CardOptionsDeck from '../card-options-deck.svelte';

	const { jump_to_query } = $props<{
		jump_to_query: (query: string) => void;
	}>();

	const { doc_state } = use_deck_cards();
</script>

<div class="pt-2">
	<TagDoc {jump_to_query} {doc_state}>
		{#snippet options(props)}
			<CardOptionsDeck zone="considering" {...props} />
		{/snippet}
	</TagDoc>
</div>
