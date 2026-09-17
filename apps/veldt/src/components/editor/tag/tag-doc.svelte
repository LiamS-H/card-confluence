<script lang="ts">
	// TODO: don't love the preview layout, ideal ux would be a codemirror state extension, put a little + next to the tag you are editing to expand the preview beneath
	// show a little ticker beneath the tag you are editing which shows error when error and + expand otherwise
	import { onMount } from 'svelte';
	import { type QueryResultRow } from '$lib';
	import { use_query } from '$lib';
	import VirtualGrid from '$components/virtual-grid.svelte';
	import RowResult from '$components/query/row-result.svelte';
	import { Button } from '$components/ui/button';
	import CardImg from '$components/card-img';
	import * as Card from '$components/ui/card';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';

	const { jump_to_query } = $props<{
		jump_to_query: (query: string) => void;
	}>();

	const deck = use_deck_cards();

	let editorContainer: HTMLDivElement;

	const query = $derived.by(() => {
		if (deck.cursor_tag === null) return '';
		return (deck.doc_obj.domain ?? '') + ' ' + deck.cursor_tag.query;
	});
	let data = use_query(() => ({ query }), 500);
	const { response } = $derived(data);

	// Trigger an immediate query when the cursor moves to a tag
	$effect(() => {
		const ct = deck.cursor_tag;
		if (ct) {
			data.query_now({ query: (deck.doc_obj.domain ?? '') + ' ' + ct.query });
		}
	});

	onMount(() => {
		// get_view() is idempotent — creates once, returns the same instance on re-mount.
		// The view keeps running (yCollab, onDeckUpdate) even when detached from the DOM.
		const view = deck.get_view();
		editorContainer.appendChild(view.dom);

		return () => {
			// Detach from DOM but do NOT destroy — view stays alive for background updates.
			editorContainer.removeChild(view.dom);
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
		{#if previewOpen && deck.cursor_tag}
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
						<div class="min-h-96">
							<VirtualGrid items={response.result.rows} columns={previewColumns} overscan={2}>
								{#snippet item({ index, viewportRow, col })}
									<div class="p-1">
										<RowResult
											result={response.result.rows[index] as QueryResultRow}
											key={`${viewportRow}-${col}`}
										>
											{#snippet children({ card, print, width })}
												<CardImg {card} {print} {width} />
											{/snippet}
										</RowResult>
									</div>
								{/snippet}
							</VirtualGrid>
						</div>
					{/if}
				</Card.Body>
				<div class="flex flex-row-reverse justify-between">
					<span
						class="flex flex-1 items-center justify-center bg-foreground text-xl text-background"
					>
						{deck.cursor_tag.name}
					</span>
					{const tag_query = deck.cursor_tag.query.trim()}
					<Button
						disabled={tag_query === ''}
						onclick={() => {
							jump_to_query(tag_query);
						}}>search +</Button
					>

					<Button intent="destructive" onclick={() => (previewOpen = false)}>close</Button>
				</div>
			</div>
		{:else if !previewOpen && deck.cursor_tag}
			<Button onclick={() => (previewOpen = true)}>preview</Button>
		{/if}
	</div>
</div>
