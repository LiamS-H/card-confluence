<script lang="ts">
	import type { DeckStruct } from '@repo/schema-sync';
	import { sync_client } from '$lib/sync/client';
	import Input from '$components/input.svelte';
	import TagDoc from './tag/tag-doc.svelte';
	import Button from '$components/button.svelte';
	import Deck from './deck/deck.svelte';
	import { use_deck_cards_provider } from '$lib/sync/use-cards.svelte';
	import CardSearch from './search/card-search.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const { deck }: { deck: DeckStruct } = $props();

	use_deck_cards_provider(() => deck);

	const doc = $derived(deck.get('doc'));
	const title = $derived(deck.get('title'));
	let title_string = $state('loading');

	$effect(() => {
		title_string = title.toJSON();
		title.observe(() => {
			title_string = title.toJSON();
		});
	});

	const views = ['deck', 'tags', 'card +'] as const;
	let view = $state<(typeof views)[number]>('deck');

	function jump_to_query(query: string) {
		const params = new URL(page.url).searchParams;

		if (query) {
			params.set('q', query.trim());
		} else {
			params.delete('q');
		}

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}/?${params.toString()}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
		view = 'card +';
		console.log('test');
	}
</script>

<div class="flex h-full flex-col gap-2">
	<div class="flex items-center justify-between">
		<Input
			placeholder="Unnamed Deck"
			type="text"
			value={title_string}
			oninput={(event) => {
				const newValue = event.currentTarget.value;
				sync_client.get_doc().transact(() => {
					title.delete(0, title.length);
					title.insert(0, newValue);
				});
			}}
		/>
	</div>
	<div class="h-full w-full border outline *:-my-px">
		{#each views as name (name)}
			<Button
				intent={name === view ? 'secondary' : null}
				variant={name === view ? 'fixed' : 'outline'}
				onclick={() => (view = name)}
			>
				{name}
			</Button>
		{/each}
		{#if view === 'tags'}
			<TagDoc {doc} {jump_to_query} />
		{:else if view === 'deck'}
			<Deck />
		{:else if view === 'card +'}
			<CardSearch />
		{/if}
	</div>
</div>
