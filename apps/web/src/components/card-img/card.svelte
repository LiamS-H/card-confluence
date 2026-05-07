<script lang="ts">
	import type { Print, Card } from 'wasm-browser/dist full matches';
	import Illustration from './illustration.svelte';
	import Error from './error.svelte';
	import MultiFaced from './multi-faced.svelte';

	export type CardSizeProps =
		| {
				width: string | number;
				height?: undefined;
		  }
		| {
				width?: undefined;
				height: string | number;
		  };

	const { card, print, width, height }: { card: Card; print: Print } & CardSizeProps = $props();
	const [dim, size] = $derived.by(() => {
		if (height !== undefined) {
			return ['height', height] as const;
		}
		return ['width', width] as const;
	});
</script>

<div
	class="relative flex aspect-5/7 items-center justify-center overflow-clip rounded-[4.75%/3.5%] bg-[#17150f]"
	style={`${dim}:${size}px`}
>
	{#if print.illustrations.length === 0}
		<Error message={`${card.name}, ${print.scryfall_id} Couldn't find illustration`} />
	{:else if print.illustrations.length === 1}
		<Illustration illustration={print.illustrations[0]} alt={card.name} />
	{:else}
		<MultiFaced illustrations={print.illustrations} alt={card.name} />
	{/if}
</div>
