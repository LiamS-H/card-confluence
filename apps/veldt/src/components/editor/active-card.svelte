<script lang="ts">
	import { use_card } from '$lib';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CardInfo, CardInfoError, CardInfoLoading } from '$components/card-dialog';
	import * as Dialog from '$components/ui/dialog';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { Button } from '$components/ui/button';
	import { uuid_to_string, string_to_uuid, uuid_key } from '$lib/utils/uuid';

	const url_card = $derived(page.url.searchParams.get('card'));
	const url_print = $derived(page.url.searchParams.get('print'));
	let oracle_id = $derived(url_card ? string_to_uuid(url_card) : null);
	let print_id = $derived(url_print ? string_to_uuid(url_print) : null);

	const { card } = $derived.by(() => {
		if (!oracle_id) return { card: null };
		return use_card(() => oracle_id);
	});

	function on_change(open: boolean) {
		if (open) return;
		const params = new URL(page.url).searchParams;
		params.delete('card');
		params.delete('print');
		goto(`${page.url.pathname}?${params.toString()}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	const deck = use_deck_cards();
</script>

<Dialog.Root bind:open={() => !!oracle_id, on_change}>
	<Dialog.Content
		class="h-11/12 max-h-11/12 w-full min-w-48 p-0 pt-9 sm:min-w-xl md:min-w-3xl lg:min-w-5xl"
	>
		{#if card}
			{#if card.loading}
				<Dialog.Title class="sr-only">Selected Card Loading</Dialog.Title>
				<Dialog.Description class="sr-only"
					>Info for a card you selected is currently loading.</Dialog.Description
				>
				<CardInfoLoading />
			{:else if card.error}
				<Dialog.Title class="sr-only">Selected Card Error</Dialog.Title>
				<Dialog.Description class="sr-only">{card.message}</Dialog.Description>
				<CardInfoError message={card.message} />
			{:else}
				<Dialog.Title class="sr-only">Selected Card</Dialog.Title>
				<Dialog.Description class="sr-only">{card.result.name}</Dialog.Description>
				{const print_index = card.result.prints.findIndex((s) => {
					if (!print_id) return false;
					return uuid_key(s.scryfall_id) === uuid_key(print_id);
				})}
				<CardInfo card={card.result} {print_index} />

				{const print = $derived(card.result.prints[print_index] ?? null)}
				{#if print !== null}
					<Button
						onclick={() => {
							// TODO: replace this with an adequate move_cards
							deck.mutate.add_cards(
								uuid_to_string(card.result.oracle_id),
								uuid_to_string(print.scryfall_id),
								'commander',
								1
							);
						}}>Make Commander</Button
					>
				{/if}
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
