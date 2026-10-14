<script lang="ts">
	import { type Snippet } from 'svelte';
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
		ref = $bindable(null),
		...restProps
	}: VirtualGridProps = $props();

	let width = $state(0);
	let offsetTop = $state(0);
	let viewportHeight = $state(0);

	function update() {
		if (!ref) return;
		offsetTop = ref.getBoundingClientRect().top;
		viewportHeight = window.innerHeight;
	}

	$effect(() => {
		update();
		window.addEventListener('scroll', update, { capture: true, passive: true });
		window.addEventListener('resize', update, { passive: true });
		return () => {
			window.removeEventListener('scroll', update, { capture: true });
			window.removeEventListener('resize', update);
		};
	});

	const itemWidth = $derived(setItemWidth ?? width / columns);
	const itemHeight = $derived(setItemHeight ?? (setItemWidth ?? itemWidth) / aspectRatio);
	const totalRows = $derived(Math.ceil(length / columns));
	const totalHeight = $derived(totalRows * itemHeight);

	const visible = $derived.by(() => {
		if (!itemWidth || !itemHeight) return [];
		const scrolled = -offsetTop;
		const start = Math.max(0, Math.floor(scrolled / itemHeight) - overscan);
		const end = Math.min(totalRows, Math.ceil((scrolled + viewportHeight) / itemHeight) + overscan);
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
	style:height="{totalHeight}px"
	bind:this={ref}
	bind:clientWidth={width}
	class={cn('relative w-full', className)}
	{...restProps}
>
	{#each visible as v (v.index)}
		<div
			class="absolute top-0 left-0 will-change-transform"
			style:width="{itemWidth}px"
			style:height="{itemHeight}px"
			style:transform="translate({v.x}px, {v.y}px)"
		>
			{@render item?.(v)}
		</div>
	{/each}
</div>
