<script module lang="ts">
	import { type ScryfallList, type ScryfallError } from '@scryfall/api-types';

	type ScryfallReturn = ScryfallList.CardSymbols | ScryfallError;

	const scryfallSymbolsPromise = fetch('https://api.scryfall.com/symbology', {
		headers: {
			'User-Agent': 'card-confluence/0.0',
			Accept: '*/*'
		}
	})
		.then((res) => res.json() as unknown as Promise<ScryfallReturn>)
		.then((json) => {
			if (json.object === 'error') {
				console.error('[symbols] unavailable', json);
				return {};
			}
			const map: Record<string, string> = {};
			json.data.forEach((sym: any) => {
				map[sym.symbol] = sym.svg_uri;
			});
			return map;
		})
		.catch((err) => {
			console.warn('[symbols] unavailable', err);
			return {};
		});

	function parseTokens(text: string, symbols: Record<string, string>) {
		const regex = /(\{[^}]+\})/g;
		const tokens = [];
		let match;
		let lastIndex = 0;

		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) });
			}

			const symbolName = match[1].toUpperCase();
			const symbolUrl = symbols[symbolName];

			if (symbolUrl) {
				tokens.push({ type: 'symbol', src: symbolUrl, alt: symbolName });
			} else {
				tokens.push({ type: 'text', content: match[0] });
			}
			lastIndex = regex.lastIndex;
		}

		if (lastIndex < text.length) {
			tokens.push({ type: 'text', content: text.slice(lastIndex) });
		}
		return tokens;
	}
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		text,
		class: className,
		...restProps
	}: Omit<WithElementRef<HTMLAttributes<HTMLSpanElement>>, 'children'> & {
		text: string;
	} = $props();
</script>

{#await scryfallSymbolsPromise}
	<span class={cn('', className)} {...restProps}>{text}</span>
{:then symbols}
	<span class={cn('', className)} {...restProps}>
		{#each parseTokens(text, symbols) as token}
			{#if token.type === 'symbol'}
				<img src={token.src} alt={token.alt} class="inline-block h-[1em] w-[1em] align-middle" />
			{:else}
				{token.content}
			{/if}
		{/each}
	</span>
{/await}
