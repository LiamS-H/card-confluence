<script lang="ts">
	import { TagDoc } from '$components/tag-doc';
	import { use_deck_edit } from '$lib/editor';
	import CardOptionsDeck from '../card-options-deck.svelte';

	const { jump_to_query } = $props<{
		jump_to_query: (query: string) => void;
	}>();

	const deck = use_deck_edit();
</script>

<div class="pt-2">
	<TagDoc {jump_to_query} doc_state={deck.tag_doc}>
		{#snippet options(props)}
			<CardOptionsDeck zone="considering" {...props} />
		{/snippet}
	</TagDoc>
</div>
