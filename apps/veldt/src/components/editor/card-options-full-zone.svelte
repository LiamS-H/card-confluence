<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import type { DeckZone } from '@repo/schema-sync';

	const props: {
		zone: DeckZone;
		oracle_id: string;
		scryfall_id: string;
		count: number;
	} = $props();

	const deck = use_deck_cards();

	// svelte-ignore ; state_referenced_locally; we are just using it as an initializer
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
	<Button
		class="h-10 w-10"
		intent="destructive"
		onclick={() => {
			deck.mutate.remove_cards(props.oracle_id, props.zone, 1);
		}}>-</Button
	>
	<Input
		intent="secondary"
		variant="outline"
		class="h-10 w-20 text-center"
		bind:value={string_count}
	/>
	<Button
		class="h-10 w-10"
		onclick={() => {
			deck.mutate.add_cards(props.oracle_id, props.scryfall_id, props.zone, 1);
		}}>+</Button
	>
	<span class="flex h-10 grow items-center justify-center bg-foreground text-xl text-background"
		>{props.zone}</span
	>
</div>
