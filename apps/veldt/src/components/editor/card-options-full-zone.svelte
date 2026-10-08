<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input, type InputProps } from '$components/ui/input';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import type { DeckZone } from '@repo/schema-sync';

	const props: {
		zone: DeckZone;
		oracle_id: string;
		scryfall_id: string;
		count: number;
	} = $props();

	const deck = use_deck_cards();

	// svelte-ignore state_referenced_locally; we are just using it as an initializer
	let string_count = $state(props.count.toString());

	$effect(() => {
		string_count = props.count.toString();
	});

	$effect(() => {
		const parsed = parseInt(string_count);
		if (Number.isNaN(parsed)) {
			string_count = props.count.toString();
			return;
		}
		const dif = parsed - props.count;
		if (dif > 0) {
			deck.mutate.add_cards(props.oracle_id, props.scryfall_id, props.zone, dif);
		}
		if (dif < 0) {
			deck.mutate.remove_cards(props.oracle_id, props.zone, -dif);
		}
	});
</script>

<div class="flex">
	<span class="p-2 text-xl">{props.zone}:</span>
	<Button
		intent="destructive"
		onclick={() => {
			deck.mutate.remove_cards(props.oracle_id, props.zone, 1);
		}}>-</Button
	>
	<Input intent="secondary" variant="outline" class="w-20 text-center" bind:value={string_count} />
	<Button
		onclick={() => {
			deck.mutate.add_cards(props.oracle_id, props.scryfall_id, props.zone, 1);
		}}>+</Button
	>
</div>
