<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cva, type VariantProps } from 'class-variance-authority';

	const buttonVariants = cva(
		'group relative overflow-hidden transition-colors disabled:opacity-50 disabled:pointer-events-none',
		{
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
				},
				width: {
					auto: 'w-auto',
					full: 'w-full'
				}
			},

			defaultVariants: {
				intent: 'default',
				variant: 'outline',
				size: 'md',
				width: 'auto'
			}
		}
	);

	type ButtonVariants = VariantProps<typeof buttonVariants>;

	interface Props extends Omit<HTMLButtonAttributes, 'class'> {
		children: Snippet;
		intent?: ButtonVariants['intent'];
		variant?: ButtonVariants['variant'];
		size?: ButtonVariants['size'];
		width?: ButtonVariants['width'];
		class?: string;
	}

	let {
		children,
		intent,
		variant,
		width,
		size,
		class: className,
		disabled,
		...rest
	}: Props = $props();

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

	// const spanTranslate = $derived(
	// 	variant === 'fixed'
	// 		? 'scale-x-100'
	// 		: variant === 'full'
	// 			? 'origin-left scale-x-100 group-hover:origin-right group-hover:scale-x-0'
	// 			: 'origin-right scale-x-0 group-hover:origin-left group-hover:scale-x-100'
	// );
</script>

<button
	{disabled}
	class={buttonVariants({ intent, variant, size, width, class: className })}
	{...rest}
>
	<span
		class="absolute inset-y-0 left-[-10%] z-0 w-[120%] skew-x-12 transition-transform duration-300
           {bgMap[intent ?? 'default']} {spanTranslate}"
	></span>
	<span class="relative z-10 mix-blend-difference">
		{@render children()}
	</span>
</button>
