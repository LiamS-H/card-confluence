<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type VirtualGridProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		length: number;
		itemWidth?: number | undefined;
		itemHeight?: number | undefined;
		columns: number;
		aspectRatio?: number; // width / height, default 5/7
		overscan?: number;
		item?: Snippet<
			[{ index: number; row: number; col: number; viewportRow: number; width: number }]
		>;
	};

	let {
		length,
		columns,
		aspectRatio = 5 / 7,
		overscan = 2,
		item,
		itemWidth: setItemWidth,
		itemHeight: setItemHeight,
		class: className,
		...restProps
	}: VirtualGridProps = $props();

	let scroller: HTMLDivElement;
	let scrollTop = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	onMount(() => {
		const ro = new ResizeObserver(() => {
			viewportWidth = scroller.clientWidth;
			viewportHeight = scroller.clientHeight;
		});
		ro.observe(scroller);
		return () => ro.disconnect();
	});

	const itemWidth = $derived(setItemWidth ?? viewportWidth / columns);
	const itemHeight = $derived(setItemHeight ?? (setItemWidth ?? itemWidth) / aspectRatio);
	const totalRows = $derived(Math.ceil(length / columns));
	const totalHeight = $derived(totalRows * itemHeight);

	const visible = $derived.by(() => {
		if (!itemWidth || !itemHeight) return [];
		const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const end = Math.min(
			totalRows,
			Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
		);
		const out = [];
		for (let row = start; row < end; row++) {
			for (let col = 0; col < columns; col++) {
				const index = row * columns + col;
				if (index >= length) break;
				out.push({
					index,
					row,
					col,
					width: itemWidth,
					x: col * itemWidth,
					y: row * itemHeight,
					viewportRow: row - start
				});
			}
		}
		return out;
	});
</script>

<div
	class={cn('absolute inset-0 overflow-x-hidden overflow-y-auto', className)}
	{...restProps}
	bind:this={scroller}
	onscroll={() => (scrollTop = scroller.scrollTop)}
>
	<div style:height="{totalHeight}px" class="relative w-full">
		{#each visible as v (v.index)}
			<div
				class="t-0 l-0 absolute will-change-transform"
				style:width="{itemWidth}px"
				style:height="{itemHeight}px"
				style:transform="translate({v.x}px, {v.y}px)"
			>
				{@render item?.(v)}
			</div>
		{/each}
	</div>
</div>
