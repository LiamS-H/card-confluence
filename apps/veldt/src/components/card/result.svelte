<script lang="ts">
	import { page } from '$app/state';
	import { CardImage, CardImageError, CardImageLoading } from '$components/card-img';
	import { CardTile, CardTileError, CardTileLoading } from '$components/card-tile';
	import RowResult from '$components/query/row-result.svelte';
	import type { QueryResultRow } from '$lib';
	import type { Card as CardObj, Print } from '@card-confluence/wasm-browser';
	import type { Snippet } from 'svelte';
	import Options from './options.svelte';
	import type { CardVariant } from '$lib/settings/settings-local.svelte';
	import { uuid_to_string } from '$lib/utils/uuid';

	export type OptionsSnippet = Snippet<[{ card: CardObj; print: Print; variant: CardVariant }]>;

	const {
		result,
		key,
		width,
		options: _options,
		variant,
		onclick
	}: {
		result: QueryResultRow;
		key?: string;
		width: string | number;
		options?: OptionsSnippet;
		variant: CardVariant;
		onclick?: undefined | (() => void);
	} = $props();
</script>

{#snippet options({ card, print }: { card: CardObj; print: Print })}
	{#if _options}
		{@render _options({ card, print, variant })}
	{:else}
		<Options {card} {print} {variant} />
	{/if}
{/snippet}

<RowResult {result} {key}>
	{#snippet success({ card, print })}
		{const href = $derived.by(() => {
			const params = new URL(page.url).searchParams;
			params.set('card', uuid_to_string(card.oracle_id));
			params.set('print', uuid_to_string(print.scryfall_id));
			return `${page.url.pathname}?${params.toString()}`;
		})}
		{const actions = $derived.by(() => {
			if (onclick) {
				return { onclick };
			}
			return { href };
		})}

		{#if variant === 'img-full'}
			<div class="relative" style:width>
				<CardImage {...actions} {card} {print} {width} />
				<div class="absolute bottom-0 left-0 z-10">
					{@render options({ card, print })}
				</div>
			</div>
		{:else if variant === 'img'}
			<div class="relative mb-[-125%]" style:width>
				<CardImage {...actions} {card} {print} {width} />
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
		{#if variant === 'img-full'}
			<CardImageLoading {width} />
		{:else if variant === 'img'}
			<CardImageLoading {width} />
		{:else if variant === 'tile'}
			<CardTileLoading {width} />
		{/if}
	{/snippet}

	{#snippet error({ message })}
		{#if variant === 'img-full'}
			<CardImageError {message} {width} />
		{:else if variant === 'img'}
			<CardImageError {message} {width} />
		{:else if variant === 'tile'}
			<CardTileError {width} {message} />
		{/if}
	{/snippet}
</RowResult>
