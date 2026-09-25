<script lang="ts">
	// TODO: Improve the ux of adding cards to decl
	// store the last deck you added cards to, kind of like the save to playlist on youtube where it defaults to one-click add and you can press again to change it
	// improve the deck picker both in functionality and look, could do with a search bar to find the decks
	// check against the domain of a deck so that suggestions contain only decks you would want to add it to
	// add to new deck option in list of decks
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import { sync_client, use_deck_meta, use_decks } from '$lib';

	import { Button } from '$components/ui/button';
	import * as Popover from '$components/ui/popover';
	import * as Card from '$components/ui/card';
	import { DeckCardInterface } from '$lib/sync/use-deck-cards.svelte';
	import type { DeckStruct } from '@repo/schema-sync';

	const {
		card,
		print
	}: {
		card: CardObj;
		print: Print;
	} = $props();

	let isOpen = $state(false);
	const decks = use_decks();

	function add_card_to_deck(id: string) {
		const deck = sync_client.decks_root.get(id) as DeckStruct;
		const int = new DeckCardInterface(deck);
		int.mutate.add_cards(card.oracle_id, print.scryfall_id, 'considering', 1);
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="default"
				variant={isOpen ? 'fixed' : 'outline'}
				onclick={() => (isOpen = !isOpen)}
			>
				+
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-fit" align="start">
		<Card.Root intent="default">
			<Card.Body>
				<ul class="max-h-72 overflow-y-auto">
					{#each decks.ids as id}
						{const deck = $derived(use_deck_meta(() => id))}
						{#if deck.deck.error === null}
							<li>
								{#if Object.hasOwn(deck.deck.deck.cards, card.oracle_id)}
									<div>
										<span class="text-xl text-muted-foreground">{deck.deck.deck.title}</span>
									</div>
								{:else}
									<Button
										onclick={() => {
											add_card_to_deck(id);
											isOpen = false;
										}}
									>
										{deck.deck.deck.title}
									</Button>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			</Card.Body>
		</Card.Root>
	</Popover.Content>
</Popover.Root>
