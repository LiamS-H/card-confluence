<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
	import { query_client } from '$lib';
	import { karooSetup } from '$lib/codemirror';

	const { doc, onDocChange }: { doc: string; onDocChange: (doc: string) => void } = $props();

	const getDoc = () => doc;

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		// 1. Create the state
		const state = EditorState.create({
			doc: doc,
			selection: { anchor: doc.length },
			extensions: [
				cardconfluenceWithContext({
					complete: async (pos) => {
						const query = getDoc();
						return await query_client.autocomplete(
							{
								query
							},
							pos
						);
					}
				}),
				karooSetup,
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

		view.focus();

		return () => {
			view.destroy();
		};
	});
</script>

<div bind:this={editorContainer}></div>
