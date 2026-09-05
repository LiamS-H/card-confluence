<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import OracleSpan from './oracle-span.svelte';
	let {
		ref = $bindable(null),
		class: className,
		text,
		...restProps
	}: Omit<WithElementRef<HTMLAttributes<HTMLParagraphElement>>, 'children'> & {
		text: string;
	} = $props();
</script>

<p bind:this={ref} class={cn('flex flex-col', className)} {...restProps}>
	{#each text.split('\n') as line}
		<OracleSpan text={line} />
	{/each}
</p>
