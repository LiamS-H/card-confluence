<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cva, type VariantProps } from 'class-variance-authority';

	const buttonVariants = cva(
		'group relative overflow-hidden border outline px-4 py-1 transition-colors disabled:opacity-50 disabled:pointer-events-none',
		{
			variants: {
				intent: {
					default: 'border-foreground outline-foreground text-foreground',
					primary: 'border-primary outline-primary text-primary',
					secondary: 'border-secondary outline-secondary text-secondary',
					destructive: 'border-destructive outline-destructive text-destructive'
				},
				variant: {
					full: '',
					outline: '',
					fixed: ''
				},
				size: {
					small: 'text-xl',
					default: 'text-2xl w-auto',
					full: 'text-2xl w-full'
				}
			},

			defaultVariants: {
				intent: 'default',
				variant: 'outline',
				size: 'default'
			}
		}
	);

	type ButtonVariants = VariantProps<typeof buttonVariants>;

	interface Props extends Omit<HTMLButtonAttributes, 'class'> {
		children: Snippet;
		intent?: ButtonVariants['intent'];
		variant?: ButtonVariants['variant'];
		size?: ButtonVariants['size'];
		class?: string;
	}

	let { children, intent, variant, size, class: className, disabled, ...rest }: Props = $props();

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

<button {disabled} class={buttonVariants({ intent, variant, size, class: className })} {...rest}>
	<span
		class="absolute inset-y-0 left-[-10%] z-0 w-[120%] skew-x-12 transition-transform duration-300
           {bgMap[intent ?? 'default']} {spanTranslate}"
	></span>
	<span class="relative z-10 mix-blend-difference">
		{@render children()}
	</span>
</button>
