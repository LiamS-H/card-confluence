<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export const buttonVariants = tv({
		base: 'group relative overflow-hidden transition-colors disabled:opacity-50 disabled:pointer-events-none',
		variants: {
			intent: {
				default: 'border-foreground text-foreground bg-black',
				primary: 'border-primary  text-primary bg-black',
				secondary: 'border-secondary text-secondary bg-black',
				destructive: 'border-destructive text-destructive bg-black'
			},
			variant: {
				full: 'border-2',
				outline: 'border-2',
				fixed: 'border-2'
			},
			size: {
				xs: 'text-sm px-2 py-0.5',
				sm: 'text-base px-3 py-1',
				md: 'text-xl px-3 py-1',
				lg: 'text-2xl px-3 py-1'
			}
		},

		defaultVariants: {
			intent: 'default',
			variant: 'outline',
			size: 'md',
			width: 'auto'
		}
	});

	export type ButtonVariants = VariantProps<typeof buttonVariants>;

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			children: Snippet;
			intent?: ButtonVariants['intent'];
			variant?: ButtonVariants['variant'];
			size?: ButtonVariants['size'];
		};
</script>

<script lang="ts">
	let {
		class: className,
		intent,
		variant,
		size,
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();

	const bgMap: Record<string, string> = {
		default: 'bg-foreground',
		primary: 'bg-primary',
		secondary: 'bg-secondary',
		destructive: 'bg-destructive'
	};

	const spanTranslate = $derived(
		variant === 'fixed'
			? 'translate-x-0'
			: variant === 'full'
				? 'translate-x-0 group-hover:translate-x-full'
				: '-translate-x-full group-hover:translate-x-0'
	);
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	bind:this={ref}
	data-slot="button"
	class={cn(buttonVariants({ intent, variant, size }), className)}
	href={href && disabled ? undefined : href}
	aria-disabled={disabled}
	role={href && disabled ? 'link' : undefined}
	tabindex={disabled ? -1 : undefined}
	type={href ? undefined : type}
	{disabled}
	{...restProps}
>
	<span
		class="absolute inset-y-0 left-[-10%] z-0 w-[120%] skew-x-12 transition-transform duration-300
            {bgMap[intent ?? 'default']} {spanTranslate}"
	></span>
	<span class="relative z-10 mix-blend-difference">
		{@render children()}
	</span>
</svelte:element>
