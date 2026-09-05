<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cardVariants, type CardVariants } from './card.svelte';

	let {
		ref = $bindable(null),
		class: className,
		intent,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		intent: CardVariants['intent'];
	} = $props();
</script>

<div
	bind:this={ref}
	class={cn('flex h-10 items-center justify-center', cardVariants({ intent }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
