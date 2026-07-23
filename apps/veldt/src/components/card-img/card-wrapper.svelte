<script lang="ts">
	import type { Snippet } from 'svelte';

	export type CardSizeProps =
		| {
				width: string | number;
				height?: undefined;
		  }
		| {
				width?: undefined;
				height: string | number;
		  };
	const { width, height, alpha, children }: { alpha?: boolean; children: Snippet } & CardSizeProps =
		$props();

	const [dim, size] = $derived.by(() => {
		if (height !== undefined) {
			return ['height', height] as const;
		}
		return ['width', width] as const;
	});
	const rounding = $derived(alpha ? 'rounded-[8.5%/5.2%]' : 'rounded-[6%/4%]');
</script>

<div class={`relative aspect-5/7 overflow-clip ${rounding}`} style={`${dim}:${size}px`}>
	{@render children()}
</div>
