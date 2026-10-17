<script lang="ts" module>
	let deck_accordion_value = $state<string[]>(['tags']);
</script>

<script lang="ts">
	import { use_card } from '$lib';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CardInfo, CardInfoError, CardInfoLoading } from '$components/card-dialog';
	import * as Dialog from '$components/ui/dialog';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { Button } from '$components/ui/button';
	import { string_to_uuid, uuid_key, type UUIDString } from '$lib/utils/uuid';
	import { type DeckZone } from '@repo/schema-sync';
	import CardOptionsDeck from './card-options-deck.svelte';
	import CardOptionsDeckFull from './card-options-deck-full.svelte';
	import * as Accordion from '$components/ui/accordion';

	const url_card = $derived(page.url.searchParams.get('card'));
	const url_print = $derived(page.url.searchParams.get('print'));
	const oracle_id = $derived(url_card ? string_to_uuid(url_card) : null);
	const print_id = $derived(url_print ? string_to_uuid(url_print) : null);

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

	const [matched_tags, unmatched_tags] = $derived.by(() => {
		const matched_tags = [];
		const unmatched_tags = [];
		for (const tag of deck.tags_fetched.values()) {
			if (tag.matchedIds.has(url_card as UUIDString)) {
				matched_tags.push(tag);
			} else {
				unmatched_tags.push(tag);
			}
		}

		return [matched_tags, unmatched_tags];
	});
</script>

<Dialog.Root bind:open={() => !!oracle_id, on_change}>
	<Dialog.Content
		class="h-11/12 max-h-11/12 w-full min-w-48 p-0 sm:min-w-xl md:min-w-3xl lg:min-w-5xl"
	>
		{#if card}
			{#if card.loading}
				<Dialog.Title tabindex={-1} class="sr-only">Selected Card Loading</Dialog.Title>
				<Dialog.Description class="sr-only"
					>Info for a card you selected is currently loading.</Dialog.Description
				>
				<CardInfoLoading />
			{:else if card.error}
				<Dialog.Title tabindex={-1} class="sr-only">Selected Card Error</Dialog.Title>
				<Dialog.Description class="sr-only">{card.message}</Dialog.Description>
				<CardInfoError message={card.message} />
			{:else}
				<Dialog.Title tabindex={-1} class="sr-only">Selected Card</Dialog.Title>
				<Dialog.Description class="sr-only">{card.result.name}</Dialog.Description>
				{const print_index = $derived.by(() => {
					if (!print_id) return -1;
					const key = uuid_key(print_id);
					return card.result.prints.findIndex((s) => {
						return uuid_key(s.scryfall_id) === key;
					});
				})}

				{const active_print = $derived(card.result.prints[print_index] ?? null)}

				<div class="flex h-full max-h-full flex-col overflow-y-auto pb-20">
					<CardInfo card={card.result} {print_index} />
					<div class="w-full border-t"></div>
					<Accordion.Root bind:value={deck_accordion_value} type="multiple">
						<Accordion.Item value="tags">
							<Accordion.Trigger>Deck Tags</Accordion.Trigger>
							<Accordion.Content class="flex flex-col gap-2">
								<ul class="flex flex-wrap gap-1">
									{#each matched_tags as tag}
										<Button variant="full" intent="secondary" size="xs">
											{tag.tag.label}
											-
										</Button>
									{/each}
								</ul>
								<ul class="flex flex-wrap gap-1">
									{#each unmatched_tags as tag}
										<Button size="xs">
											{tag.tag.label}
											+
										</Button>
									{/each}
								</ul>
							</Accordion.Content>
						</Accordion.Item>

						{#if active_print}
							<Accordion.Item value="manage-counts">
								<Accordion.Trigger>Deck Counts</Accordion.Trigger>
								<Accordion.Content class="flex flex-col gap-2">
									<CardOptionsDeckFull card={card.result} print={active_print} />
								</Accordion.Content>
							</Accordion.Item>
						{/if}
					</Accordion.Root>
				</div>

				<div class="absolute bottom-0 flex w-full justify-between">
					<CardOptionsDeck
						zone="mainboard"
						card={card.result}
						print={active_print}
						variant="img-full"
					/>
					{#if deck.settings.commander && active_print !== null && url_card !== null && url_print !== null}
						{const counts = $derived(deck.get_card_counts(url_card))}
						{#if counts.commander === 0 && card.result.commander}
							<Button
								onclick={() => {
									for (const zone in counts) {
										if (zone === 'total') continue;
										const count = counts[zone as DeckZone];
										console.log(count);
										if (count === 0) continue;
										deck.mutate.remove_cards(url_card, zone as DeckZone, count);
									}
									deck.mutate.add_cards(url_card, url_print, 'commander', 1);
								}}>+ commander</Button
							>
						{:else if counts.commander > 0}
							<Button
								intent="destructive"
								onclick={() => {
									deck.mutate.add_cards(url_card, url_print, 'mainboard', 1);
									deck.mutate.remove_cards(url_card, 'commander', counts.commander);
								}}>- commander</Button
							>
						{/if}
					{/if}
				</div>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
