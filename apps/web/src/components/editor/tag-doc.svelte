<script lang="ts">
	// TODO: don't love the preview layout, ideal ux would be a codemirror state extension, put a little + next to the tag you are editing to expand the preview beneath
	// show a little ticker beneath the tag you are editing which shows error when error and + expand otherwise
	import { onMount } from 'svelte';
	import { EditorState } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { karooDeck, tagAtCursor, type Tag } from 'codemirror-lang-karoo-deck';
	import { cardconfluenceWithContext } from 'codemirror-lang-cardconfluence';
	import { query_client, type QueryResultRow } from '$lib';
	import { yCollab } from 'y-codemirror.next';
	import * as Y from 'yjs';
	import { karooSetup } from '$lib/codemirror';
	import { use_query } from '$lib';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import RowResult from '$components/query/row-result.svelte';
	import Button from '$components/button.svelte';
	import Card from '$components/card-img';

	const { doc } = $props<{ doc: Y.Text }>();

	let editorContainer: HTMLDivElement;
	let view: EditorView;

	let tag: Tag | null = $state(null);
	const query = $derived(tag === null ? '' : (tag as Tag).query);
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);

	onMount(() => {
		const undoManager = new Y.UndoManager(doc);
		const state = EditorState.create({
			doc: doc.toJSON(),
			extensions: [
				karooSetup,
				karooDeck(),
				cardconfluenceWithContext({
					complete: async (pos: number) => {
						const tag = tagAtCursor(view.state, pos);
						if (tag === null || tag.queryPos === null) {
							return { from: pos, to: pos, options: [] };
						}

						const { from, to, options } = await query_client.autocomplete(
							{
								query: tag.query
							},
							tag.queryPos
						);

						return { options, from: pos, to: pos + (to - from) };
					}
				}),
				yCollab(doc, null, { undoManager }),
				EditorView.updateListener.of((view) => {
					const newTag = tagAtCursor(view.state, view.state.selection.main.head);
					tag = newTag;
				}),
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

	let previewOpen = $state(true);
	let previewW: number | undefined = $state();
	let previewH = $state();
	const previewColumns = $derived(Math.max(1, Math.floor((previewW ?? 428) / 200)));
</script>

<div class="relative">
	<div bind:this={editorContainer} class="w-full"></div>

	<div class="absolute top-2 right-2">
		{#if previewOpen && query !== ''}
			<div
				class="flex min-h-107 min-w-96 resize flex-col overflow-hidden border-2 border-foreground bg-background [direction:rtl] *:-my-px"
				bind:offsetWidth={previewW}
				bind:offsetHeight={previewH}
				style:width={previewW ? `${previewW}px` : undefined}
				style:height={previewH ? `${previewH}px` : undefined}
			>
				<div class="flex flex-1 flex-col [direction:ltr]">
					<div class="relative flex flex-1 justify-center">
						{#if response.loading}
							<span>loading</span>
						{:else if response.error}
							<span>{response.message}</span>
						{:else if response.result.rows.length === 0}
							<span>0 results</span>
						{:else}
							<div class="min-h-96">
								<VirtualGrid items={response.result.rows} columns={previewColumns} overscan={2}>
									{#snippet item({ index, row, col })}
										<div class="p-1">
											<RowResult
												result={response.result.rows[index] as QueryResultRow}
												key={`${row}-${col}`}
											>
												{#snippet children({ card, print, width })}
													<Card {card} {print} {width} />
												{/snippet}
											</RowResult>
										</div>
									{/snippet}
								</VirtualGrid>
							</div>
						{/if}
					</div>
					<div class="flex justify-between border-t-2 border-foreground *:-my-px">
						<span
							class="flex flex-1 items-center justify-center bg-foreground text-xl text-background"
						>
							{tag?.name}
						</span>
						<Button>search +</Button>

						<Button intent="destructive" onclick={() => (previewOpen = false)}>close</Button>
					</div>
				</div>
			</div>
		{:else if !previewOpen}
			<Button onclick={() => (previewOpen = true)} intent={tag ? 'primary' : 'default'}
				>preview</Button
			>
		{/if}
	</div>
</div>
