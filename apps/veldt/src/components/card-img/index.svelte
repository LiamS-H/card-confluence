<script lang="ts">
	import type { Print, Card } from '@card-confluence/wasm-browser';
	import Illustration from './illustration.svelte';
	import Error from './error.svelte';
	import MultiFaced from './multi-faced.svelte';
	import CardWrapper, { type CardSizeProps } from './card-wrapper.svelte';

	export type CardActionProps =
		| {
				href: string;
				onclick?: undefined;
		  }
		| {
				href?: undefined;
				onclick: () => void;
		  };

	const {
		card,
		print,
		href,
		onclick,
		...size
	}: { card: Card; print: Print } & CardSizeProps & CardActionProps = $props();
</script>

{#if print.illustrations.length === 0}
	<Error {...size} message={`${card.name}, ${print.scryfall_id} Couldn't find illustration`} />
{:else}
	<CardWrapper alpha={print.set_code === 'lea'} {...size}>
		{#if print.illustrations.length === 1}
			<Illustration
				{...{ href, onclick } as CardActionProps}
				illustration={print.illustrations[0]}
				alt={card.name}
			/>
		{:else}
			<MultiFaced
				{...{ href, onclick } as CardActionProps}
				illustrations={print.illustrations}
				alt={card.name}
			/>
		{/if}
	</CardWrapper>
{/if}
