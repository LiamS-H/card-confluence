<script lang="ts" generics="T">
	import { onMount, type Snippet } from 'svelte';

	type Props<T> = {
		items: T[];
		height: number | string;
		width?: number | string;
		itemWidth: number;
		itemHeight: number;
		overscan?: number;
		// Define the snippet prop and the arguments it will pass back to the parent
		item?: Snippet<[{ index: number; item: T; row: number; col: number; x: number; y: number }]>;
	};

	let {
		items,
		height,
		width = '100%',
		itemWidth,
		itemHeight,
		overscan = 4,
		item
	}: Props<T> = $props();

	let container: HTMLDivElement;

	let scrollTop = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	function updateViewport() {
		if (!container) return;

		viewportWidth = container.clientWidth;
		viewportHeight = container.clientHeight;
	}

	onMount(() => {
		updateViewport();

		const resize = new ResizeObserver(updateViewport);
		resize.observe(container);

		return () => resize.disconnect();
	});

	const columns = $derived(Math.max(1, Math.floor(viewportWidth / itemWidth)));
	const totalRows = $derived(Math.ceil(items.length / columns));
	const totalHeight = $derived(totalRows * itemHeight);
	const startRow = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
	const endRow = $derived(
		Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)
	);

	const visible = $derived.by(() => {
		const out: {
			index: number;
			row: number;
			col: number;
			x: number;
			y: number;
			item: T;
		}[] = [];

		for (let row = startRow; row < endRow; row++) {
			for (let col = 0; col < columns; col++) {
				const index = row * columns + col;

				if (index >= items.length) break;

				out.push({
					index,
					row: row - startRow,
					col,
					x: col * itemWidth,
					y: row * itemHeight,
					item: items[index]
				});
			}
		}

		return out;
	});
</script>

<div
	bind:this={container}
	class="virtual-grid"
	style:height={typeof height === 'number' ? `${height}px` : height}
	style:width={typeof width === 'number' ? `${width}px` : width}
	onscroll={() => {
		scrollTop = container.scrollTop;
	}}
>
	<div class="spacer" style:height={`${totalHeight}px`}>
		{#each visible as v (v.index)}
			<div
				class="item"
				style:width={`${itemWidth}px`}
				style:height={`${itemHeight}px`}
				style:transform={`translate(${v.x}px, ${v.y}px)`}
			>
				{#if item}
					{@render item({ index: v.index, item: v.item, row: v.row, col: v.col, x: v.x, y: v.y })}
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.virtual-grid {
		overflow: auto;
		position: relative;
	}

	.spacer {
		position: relative;
		width: 100%;
	}

	.item {
		position: absolute;
		top: 0;
		left: 0;
		will-change: transform;
	}
</style>
