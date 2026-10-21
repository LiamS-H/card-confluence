<script lang="ts">
	import { cn } from '$lib/utils/components';
	import type { Snippet } from 'svelte';

	export type CardSizeProps =
		| {
				class?: string | undefined;
				width: string | number;
				height?: undefined;
		  }
		| {
				class?: string | undefined;
				width?: undefined;
				height: string | number;
		  };
	const {
		class: className,
		width,
		height,
		alpha,
		children
	}: { alpha?: boolean; children: Snippet } & CardSizeProps = $props();

	const [dim, size] = $derived.by(() => {
		if (height !== undefined) {
			return ['height', height] as const;
		}
		return ['width', width] as const;
	});
	const rounding = $derived(alpha ? 'rounded-[8.5%/5.2%]' : 'rounded-[6%/4%]');
</script>

<div
	class={cn(className, `relative aspect-5/7 overflow-clip ${rounding}`)}
	style={`${dim}:${size}`}
>
	{@render children()}
</div>
