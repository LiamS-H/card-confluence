<script lang="ts">
	import { Button } from '$components/ui/button';
	import type { CardVariant } from '$lib/settings/settings-local.svelte';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { uuid_to_string } from '$lib/utils/uuid';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';

	const props: { card: CardObj; print: Print; variant: CardVariant } = $props();
	const deck = use_deck_cards();
	const oracle_id = $derived(uuid_to_string(props.card.oracle_id));

	const button_size = $derived(props.variant === 'img-full' ? 'md' : 'xs');
</script>

<div class="flex">
	<Button
		size={button_size}
		onclick={() => {
			deck.mutate.move_cards(oracle_id, 'considering', 'mainboard', 1);
		}}
	>
		{#if props.variant === 'img-full'}
			main{/if} +
	</Button>
	{#if deck.settings.sideboard}
		<Button
			size={button_size}
			intent="secondary"
			onclick={() => {
				deck.mutate.move_cards(oracle_id, 'considering', 'sideboard', 1);
			}}
			>{#if props.variant === 'img-full'}
				side{/if}
			+
		</Button>
	{/if}

	<Button
		size={button_size}
		intent="destructive"
		onclick={() => {
			deck.mutate.remove_cards(oracle_id, 'considering', 1);
		}}
	>
		-
	</Button>
</div>
