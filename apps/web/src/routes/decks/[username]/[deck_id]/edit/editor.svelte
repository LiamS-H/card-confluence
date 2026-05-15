<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { basicSetup } from 'codemirror';
	import { karooDeck } from 'codemirror-lang-karoo-deck';
	import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
	import { query_client } from '$lib/card-confluence/client.svelte';
	import { yCollab } from 'y-codemirror.next';
	import * as Y from 'yjs';
	import type { DeckStruct } from '@repo/schema-sync';
	import { sync_client } from '$lib/sync/client';

	const { deck } = $props<{ deck: DeckStruct }>();

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		const doc = deck.get('doc') as Y.Text;
		const undoManager = new Y.UndoManager(doc);
		const state = EditorState.create({
			doc: doc.toJSON(),
			extensions: [
				basicSetup,
				karooDeck(),
				cardconfluenceWithContext({
					complete: async (pos: number) => {
						return await query_client.autocomplete(
							{
								query: view.state.doc.toString()
							},
							pos
						);
					}
				}),
				yCollab(doc, null, { undoManager }),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' }
				})
			]
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});

		return () => {
			view.destroy();
		};
	});

	const title = $derived(deck.get('title')) as Y.Text;
	let title_string = $state(title.toJSON());

	// 3. Listen for Yjs changes (from remote peers or local transactions)
	$effect(() => {
		title.observe(() => {
			title_string = title.toString();
		});
	});
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<input
			placeholder="Unnamed Deck"
			class="border-x-0 border-t-0 border-b-2 border-foreground bg-transparent p-0 text-2xl focus:border-primary focus:text-primary focus:ring-0 focus:outline-none"
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
	<div bind:this={editorContainer} class="h-full w-full border"></div>
</div>

<!-- <style>
	:global(.cm-editor) {
		height: 100%;
	}
</style> -->
