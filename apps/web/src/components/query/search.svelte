<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { basicSetup } from 'codemirror';
	import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
	import { query_client } from '$lib/card-confluence/client.svelte';

	const { doc, onDocChange }: { doc: string; onDocChange: (doc: string) => void } = $props();

	const getDoc = () => doc;

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		// 1. Create the state
		const state = EditorState.create({
			doc: doc,
			extensions: [
				cardconfluenceWithContext({
					complete: async (pos) => {
						return await query_client.autocomplete(
							{
								query: getDoc()
							},
							pos
						);
					}
				}),
				basicSetup,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onDocChange(update.state.doc.toString());
					}
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
</script>

<div bind:this={editorContainer} class="h-30 w-full overflow-hidden text-base"></div>
