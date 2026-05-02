<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { basicSetup } from 'codemirror';
	import { cardconfluence } from 'codemirror-lang-cardconfluence';

	const { doc, onDocChange }: { doc: string; onDocChange: (doc: string) => void } = $props();

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		// 1. Create the state
		const state = EditorState.create({
			doc: doc,
			extensions: [
				cardconfluence(),
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

<div
	bind:this={editorContainer}
	class="h-96 w-full overflow-hidden rounded-md border border-gray-300 text-base"
></div>
