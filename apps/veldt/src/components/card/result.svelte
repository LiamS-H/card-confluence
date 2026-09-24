<script lang="ts">
	import { page } from '$app/state';
	import { CardImage, CardImageError, CardImageLoading } from '$components/card-img';
	import { CardTile, CardTileError, CardTileLoading } from '$components/card-tile';
	import RowResult from '$components/query/row-result.svelte';
	import type { QueryResultRow } from '$lib';
	import { get_local_settings } from '$lib/local-settings.svelte';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { Snippet } from 'svelte';
	import Options from './options.svelte';

	const {
		result,
		key,
		width,
		options: _options
	}: {
		result: QueryResultRow;
		key?: string;
		width: string | number;
		options?: Snippet<[{ card: CardObj; print: Print }]>;
	} = $props();
	const {
		cards: { variant }
	} = get_local_settings();
</script>

{#snippet options({ card, print }: { card: CardObj; print: Print })}
	{#if _options}
		{@render _options({ card, print })}
	{:else}
		<Options {card} {print} />
	{/if}
{/snippet}

<RowResult {result} {key}>
	{#snippet success({ card, print })}
		{const href = $derived.by(() => {
			const params = new URL(page.url).searchParams;
			params.set('card', card.oracle_id);
			params.set('print', print.scryfall_id);
			return `${page.url.pathname}?${params.toString()}`;
		})}

		{#if variant === 'img'}
			<div class="relative" style:width>
				<CardImage {href} {card} {print} {width} />
				<div class="absolute -bottom-1 -left-1 z-10">
					{@render options({ card, print })}
				</div>
			</div>
		{:else if variant === 'tile'}
			<div class="flex w-fit" style:width>
				<a {href}>
					<CardTile {card} {width} />
				</a>
				{@render options({ card, print })}
			</div>
		{/if}
	{/snippet}

	{#snippet loading()}
		{#if variant === 'img'}
			<CardImageLoading {width} />
		{:else if variant === 'tile'}
			<CardTileLoading {width} />
		{/if}
	{/snippet}

	{#snippet error({ message })}
		{#if variant === 'img'}
			<CardImageError {message} {width} />
		{:else if variant === 'tile'}
			<CardTileError {width} {message} />
		{/if}
	{/snippet}
</RowResult>
