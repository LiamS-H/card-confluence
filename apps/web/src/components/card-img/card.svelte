<script lang="ts">
	import type { Print, Card } from 'wasm-browser/dist';
	import Illustration from './illustration.svelte';
	import Error from './error.svelte';
	import MultiFaced from './multi-faced.svelte';
	import CardWrapper, { type CardSizeProps } from './card-wrapper.svelte';

	const { card, print, ...size }: { card: Card; print: Print } & CardSizeProps = $props();
</script>

<CardWrapper alpha={print.set_code === 'lea'} {...size}>
	{#if print.illustrations.length === 0}
		<Error message={`${card.name}, ${print.scryfall_id} Couldn't find illustration`} />
	{:else if print.illustrations.length === 1}
		<Illustration illustration={print.illustrations[0]} alt={card.name} />
	{:else}
		<MultiFaced illustrations={print.illustrations} alt={card.name} />
	{/if}
</CardWrapper>
