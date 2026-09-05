<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv, type VariantProps } from 'tailwind-variants';

	export const cardVariants = tv({
		base: '',
		variants: {
			intent: {
				default: 'border-foreground bg-background text-foreground',
				primary: 'border-primary bg-primary text-primary-foreground',
				secondary: 'border-secondary bg-secondary text-secondary-foreground',
				destructive: 'border-destructive bg-destructive text-destructive-foreground'
			}
		},

		defaultVariants: {
			intent: 'default'
		}
	});

	export type CardVariants = VariantProps<typeof cardVariants>;
</script>

<script lang="ts">
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

<div bind:this={ref} class={cn(cardVariants({ intent }), className)} {...restProps}>
	{@render children?.()}
</div>
