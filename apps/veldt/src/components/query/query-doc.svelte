<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
	import { query_client } from '$lib';
	import { veldtSetup } from '$lib/codemirror';

	const { doc, onDocChange }: { doc: string; onDocChange: (doc: string) => void } = $props();

	const getDoc = () => doc;

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		console.log('mounting');
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
				veldtSetup,
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

	$effect(() => {
		const c_view = untrack(() => view);

		// Only dispatch if the prop doc differs from CodeMirror's current text
		if (c_view && doc !== c_view.state.doc.toString()) {
			c_view.dispatch({
				changes: { from: 0, to: c_view.state.doc.length, insert: doc }
			});
		}
	});
</script>

<div bind:this={editorContainer}></div>
