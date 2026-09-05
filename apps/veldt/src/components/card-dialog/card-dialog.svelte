<script lang="ts">
	import { use_card } from '$lib';
	import type { Card, Print } from '@card-confluence/wasm-browser';
	import CardInfo from './card-info.svelte';
	import PrintInfo from './print-info.svelte';
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
		class="h-11/12 max-h-11/12 w-full min-w-48 px-2 sm:min-w-xl sm:pt-8 md:min-w-3xl md:px-4 md:pt-16 lg:min-w-5xl"
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
				<Dialog.Description class="sr-only">{card.result.name}</Dialog.Description>
				{#if print_id}
					<Dialog.Title class="sr-only">Selected Print</Dialog.Title>
					{const print_index = card.result.prints.findIndex((s) => s.scryfall_id === print_id)}
					{#if print_index !== -1}
						<PrintInfo card={card.result} {print_index} />
					{:else}
						<Dialog.Title class="sr-only">Selected Print Error</Dialog.Title>
						<CardInfoError
							message={`Couldn't find print:${print_id} on oracle_id:${card.result.oracle_id}`}
						/>
					{/if}
				{:else}
					<Dialog.Title class="sr-only">Selected Card</Dialog.Title>
					<CardInfo card={card.result} />
				{/if}
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
