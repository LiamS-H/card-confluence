<script lang="ts">
	import type { DeckStruct } from '@repo/schema-sync';
	import { sync_client } from '$lib/sync/client';
	import { Input } from '$components/ui/input';
	import Document from './document/document.svelte';
	import { Button } from '$components/ui/button';
	import Deck from './deck/deck.svelte';
	import { use_deck_cards_provider } from '$lib/sync/use-deck-cards.svelte';
	import CardSearch from './cards/card-search.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ActiveCard from './active-card.svelte';
	import { ResultCard } from '$components/card';
	import { string_to_uuid } from '$lib/utils/uuid';
	import CardOptionsDeck from './card-options-deck.svelte';

	const { deck }: { deck: DeckStruct } = $props();

	const deck_interface = use_deck_cards_provider(() => deck);

	const title = $derived(deck.get('title'));
	let title_string = $state('loading');

	$effect(() => {
		title_string = title.toJSON();
		title.observe(() => {
			title_string = title.toJSON();
		});
	});

	const views = ['deck', 'tags', 'card +'] as const;
	type ViewType = (typeof views)[number];

	const active_tab_index = $derived(Number(page.url.searchParams.get('tab')) || 0);
	const view = $derived<ViewType>(views[active_tab_index] ?? views[0]);

	function switch_tab(index: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('tab', index.toString());

		goto(`?${params.toString()}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function jump_to_query(query: string) {
		const params = new URLSearchParams(page.url.searchParams);

		if (query) {
			params.set('q', query.trim());
		} else {
			params.delete('q');
		}

		params.set('tab', '2');

		goto(`?${params.toString()}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<ActiveCard />

<div class="flex h-full flex-col gap-2">
	<div class="flex items-center gap-4">
		{#if deck_interface.settings.commander && deck_interface.commander.length === 0}
			<button role="dialog" class="aspect-5/7 w-50">
				<div class="flex h-full w-full items-center justify-center border border-dashed">
					<span>+ commander</span>
				</div>
			</button>
		{/if}
		{#each deck_interface.commander as commander}
			<ResultCard
				variant={'img-full'}
				width="200px"
				result={{
					oracle_id: string_to_uuid(commander.oracle_id),
					matched_prints: string_to_uuid(commander.instances[0].scryfall_id)
				}}
			>
				{#snippet options(props)}
					<CardOptionsDeck zone="commander" {...props} />
				{/snippet}
			</ResultCard>
		{/each}
		<Input
			placeholder="Unnamed Deck"
			type="text"
			value={title_string}
			oninput={(event) => {
				const newValue = event.currentTarget.value;
				sync_client.doc.transact(() => {
					title.delete(0, title.length);
					title.insert(0, newValue);
				});
			}}
		/>
	</div>
	<div class="h-full w-full">
		<!-- Added index to the each block so we can pass it to switch_tab -->
		{#each views as name, index (name)}
			<Button
				intent={name === view ? 'secondary' : 'primary'}
				variant={name === view ? 'fixed' : 'outline'}
				onclick={() => switch_tab(index)}
			>
				{name}
			</Button>
		{/each}
		{#if view === 'tags'}
			<Document {jump_to_query} />
		{:else if view === 'deck'}
			<Deck />
		{:else if view === 'card +'}
			<CardSearch />
		{/if}
	</div>
</div>
