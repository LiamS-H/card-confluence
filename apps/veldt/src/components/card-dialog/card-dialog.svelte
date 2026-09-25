<script lang="ts">
	import { use_card } from '$lib';
	import type { Card, Print } from '@card-confluence/wasm-browser';
	import CardInfo from './card-info.svelte';
	import CardInfoError from './card-info-error.svelte';
	import CardInfoSkeleton from './card-info-skeleton.svelte';
	import * as Dialog from '$components/ui/dialog';

	const {
		oracle_id,
		print_id,
		on_close
	}: {
		oracle_id: Card['oracle_id'] | null;
		print_id: Print['scryfall_id'] | null;
		on_close: () => void;
	} = $props();

	const { card } = $derived.by(() => {
		if (!oracle_id) return { card: null };
		return use_card(() => oracle_id);
	});
</script>

<!-- TODO: Set a max height and scroll, and try to resume scroll in a smart way (so that when searching for cards on mobile it will return to same part) -->

<Dialog.Root bind:open={() => !!oracle_id, on_close}>
	<Dialog.Content
		class="h-11/12 max-h-11/12 w-full min-w-48 p-0 pt-9 sm:min-w-xl md:min-w-3xl lg:min-w-5xl"
	>
		{#if card}
			{#if card.loading}
				<Dialog.Title class="sr-only">Selected Card Loading</Dialog.Title>
				<Dialog.Description class="sr-only"
					>Info for a card you selected is currently loading.</Dialog.Description
				>
				<CardInfoSkeleton />
			{:else if card.error}
				<Dialog.Title class="sr-only">Selected Card Error</Dialog.Title>
				<Dialog.Description class="sr-only">{card.message}</Dialog.Description>
				<CardInfoError message={card.message} />
			{:else}
				<Dialog.Title class="sr-only">Selected Card</Dialog.Title>
				<Dialog.Description class="sr-only">{card.result.name}</Dialog.Description>
				{const print_index = card.result.prints.findIndex((s) => s.scryfall_id === print_id)}
				<CardInfo card={card.result} {print_index} />
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
