<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	class={cn(
		'flex flex-col items-center gap-2 border-2 border-inherit bg-background p-3 not-first:border-t-0 not-last:border-b-0',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
