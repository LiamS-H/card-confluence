<script lang="ts">
	import type { DeckStruct } from '@repo/schema-sync';
	import { sync_client } from '$lib/sync/client';
	import Input from '$components/input.svelte';
	import TagDoc from './tag-doc.svelte';
	import Button from '$components/button.svelte';

	const { deck }: { deck: DeckStruct } = $props();

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
			<TagDoc {doc} />
		{:else if view === 'deck'}
			<div></div>
		{:else if view === 'card +'}{/if}
	</div>
</div>
