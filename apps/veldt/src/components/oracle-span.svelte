<script module lang="ts">
	import { type ScryfallList, type ScryfallError } from '@scryfall/api-types';

	type ScryfallReturn = ScryfallList.CardSymbols | ScryfallError;

	type TextToken = { type: 'text'; content: string };
	type SymbolToken = { type: 'symbol'; src: string; alt: string };
	type ReminderToken = { type: 'reminder'; children: (TextToken | SymbolToken)[] };
	type Token = TextToken | SymbolToken | ReminderToken;

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

	function parseTokens(text: string, symbols: Record<string, string>): Token[] {
		const regex = /(\{[^}]+\})|([()])/g;
		const tokens: Token[] = [];
		let reminder: ReminderToken | null = null;
		let match;
		let lastIndex = 0;
		let depth = 0;

		const push = (token: TextToken | SymbolToken) => {
			(reminder ? reminder.children : tokens).push(token);
		};
		const pushText = (content: string) => {
			if (content) push({ type: 'text', content });
		};

		while ((match = regex.exec(text)) !== null) {
			pushText(text.slice(lastIndex, match.index));

			if (match[1]) {
				const symbolName = match[1].toUpperCase();
				const symbolUrl = symbols[symbolName];

				if (symbolUrl) {
					push({ type: 'symbol', src: symbolUrl, alt: symbolName });
				} else {
					pushText(match[0]);
				}
			} else if (match[2] === '(') {
				if (depth === 0) {
					reminder = { type: 'reminder', children: [] };
					tokens.push(reminder);
				}
				depth++;
				pushText('(');
			} else {
				pushText(')');
				if (depth > 0) {
					depth--;
					if (depth === 0) reminder = null;
				}
			}

			lastIndex = regex.lastIndex;
		}

		pushText(text.slice(lastIndex));
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

{#snippet inline(token: TextToken | SymbolToken)}
	{#if token.type === 'symbol'}
		<img src={token.src} alt={token.alt} class="inline-block h-[1em] w-[1em] align-middle" />
	{:else}
		{token.content}
	{/if}
{/snippet}

{#await scryfallSymbolsPromise}
	<span class={cn('', className)} {...restProps}>{text}</span>
{:then symbols}
	<span class={cn('', className)} {...restProps}>
		{#each parseTokens(text, symbols) as token}
			{#if token.type === 'reminder'}
				<span class="text-muted-foreground italic">
					{#each token.children as child}{@render inline(child)}{/each}
				</span>
			{:else}
				{@render inline(token)}
			{/if}
		{/each}
	</span>
{/await}
