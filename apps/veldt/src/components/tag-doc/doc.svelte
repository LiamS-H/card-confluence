<script lang="ts">
	// TODO: don't love the preview layout, ideal ux would be a codemirror state extension, put a little + next to the tag you are editing to expand the preview beneath
	// show a little ticker beneath the tag you are editing which shows error when error and + expand otherwise
	import { type QueryResultRow } from '$lib';
	import { use_query } from '$lib';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import { TagDocState } from './state.svelte';
	import { ResultCard } from '$components/card';
	import { use_settings } from '$lib/settings';
	import { query_with_domain } from '$lib/utils';
	import type { OptionsSnippet } from '$components/card/result.svelte';

	const { jump_to_query, doc_state, options } = $props<{
		jump_to_query?: ((query: string) => void) | undefined;
		doc_state: TagDocState;
		options?: OptionsSnippet;
	}>();

	let editorContainer: HTMLDivElement;

	const query = $derived.by(() => {
		if (doc_state.cursor_tag === null) return '';
		if (doc_state.cursor_tag.key === 'domain') {
			return doc_state.parsed.domain;
		}
		return query_with_domain(doc_state.parsed, doc_state.cursor_tag.tag.query);
	});
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);

	// svelte-ignore state_referenced_locally
	let last_tag_label = doc_state.cursor_tag
		? doc_state.cursor_tag.tag.scope + ':' + doc_state.cursor_tag.tag.label
		: null;
	$effect(() => {
		const current_tag = doc_state.cursor_tag;
		if (current_tag === null) {
			last_tag_label = null;
			return;
		}
		const new_label = current_tag.tag.scope + ':' + current_tag.tag.label;
		if (new_label === last_tag_label) {
			return;
		}
		last_tag_label = new_label;
		if (doc_state.cursor_tag.key === 'domain') {
			data.query_now({ query: current_tag.tag.query });
		} else {
			data.query_now({ query: query_with_domain(doc_state.parsed, current_tag.tag.query) });
		}
	});

	$effect(() => {
		const view = doc_state.view;
		editorContainer.appendChild(view.dom);

		return () => {
			editorContainer.removeChild(view.dom);
		};
	});

	let previewOpen = $state(true);
	let previewW: number | undefined = $state();
	let previewH = $state();
	const previewColumns = $derived(Math.max(1, Math.floor((previewW ?? 428) / 200)));

	const {
		cards: { searchVariant: variant }
	} = use_settings();
</script>

<div class="relative">
	<div bind:this={editorContainer} class="w-full"></div>

	<div class="absolute top-2 right-2">
		{#if previewOpen && doc_state.cursor_tag !== null}
			<div
				class="flex min-h-107 min-w-96 resize flex-col overflow-hidden [direction:rtl]"
				bind:offsetWidth={previewW}
				bind:offsetHeight={previewH}
				style:width={previewW ? `${previewW}px` : undefined}
				style:height={previewH ? `${previewH}px` : undefined}
			>
				<Card.Body class="relative flex flex-1 justify-center p-0 [direction:ltr]">
					{#if response.loading}
						<span>loading</span>
					{:else if response.error}
						<span>{response.message}</span>
					{:else if response.result.rows.length === 0}
						<span>0 results</span>
					{:else}
						<div class="relative h-full w-full min-w-96">
							<div class="absolute inset-0 overflow-y-scroll">
								<VirtualGrid
									length={response.result.rows.length}
									columns={previewColumns}
									overscan={2}
								>
									{#snippet item({ index, viewportRow, col })}
										<div class="p-1">
											<ResultCard
												{variant}
												width="100%"
												result={response.result.rows.at(index) as QueryResultRow}
												key={`${viewportRow}-${col}`}
												{options}
											/>
										</div>
									{/snippet}
								</VirtualGrid>
							</div>
						</div>
					{/if}
				</Card.Body>
				<div class="flex flex-row-reverse justify-between">
					<span
						class="flex flex-1 items-center justify-center bg-foreground text-xl text-background"
					>
						{doc_state.cursor_tag.tag.label}
					</span>
					{#if jump_to_query !== undefined}
						{const tag_query = $derived(doc_state.cursor_tag.tag.query.trim())}
						<Button
							disabled={tag_query === ''}
							onclick={() => {
								jump_to_query(tag_query);
							}}>search +</Button
						>
					{/if}
					<Button intent="destructive" onclick={() => (previewOpen = false)}>close</Button>
				</div>
			</div>
		{:else if !previewOpen && doc_state.cursor_tag}
			<Button onclick={() => (previewOpen = true)}>preview</Button>
		{/if}
	</div>
</div>
