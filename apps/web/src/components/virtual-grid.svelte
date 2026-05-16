<script lang="ts" generics="T">
	import { onMount, type Snippet } from 'svelte';

	type Props<T> = {
		items: T[];
		columns: number;
		aspectRatio?: number; // width / height, default 5/7
		overscan?: number;
		item?: Snippet<[{ index: number; item: T; row: number; col: number }]>;
	};

	let { items, columns, aspectRatio = 5 / 7, overscan = 2, item }: Props<T> = $props();

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

	const itemWidth = $derived(viewportWidth / columns);
	const itemHeight = $derived(itemWidth / aspectRatio);
	const totalRows = $derived(Math.ceil(items.length / columns));
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
				if (index >= items.length) break;
				out.push({ index, item: items[index], row, col, x: col * itemWidth, y: row * itemHeight });
			}
		}
		return out;
	});
</script>

<!--
  The outer wrapper must be a positioned element so this component
  can use position:absolute to fill it regardless of parent sizing.
  If your parent isn't already position:relative/absolute, add that.
-->
<div class="virtual-grid" bind:this={scroller} onscroll={() => (scrollTop = scroller.scrollTop)}>
	<div style:height="{totalHeight}px">
		{#each visible as v (v.index)}
			<div
				class="virtual-grid-item"
				style:width="{itemWidth}px"
				style:height="{itemHeight}px"
				style:transform="translate({v.x}px, {v.y}px)"
			>
				{@render item?.({ index: v.index, item: v.item, row: v.row, col: v.col })}
			</div>
		{/each}
	</div>
</div>

<style>
	.virtual-grid {
		/* Fill whatever positioned ancestor wraps this component */
		position: absolute;
		inset: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.virtual-grid > div {
		position: relative;
		width: 100%;
	}

	.virtual-grid-item {
		position: absolute;
		top: 0;
		left: 0;
		will-change: transform;
	}
</style>
