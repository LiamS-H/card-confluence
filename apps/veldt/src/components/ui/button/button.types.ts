import { type VariantProps, tv } from 'tailwind-variants';
import { type WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';

export const buttonVariants = tv({
	base: 'group isolate relative overflow-hidden transition-colors aria-disabled:opacity-50 aria-disabled:pointer-events-none',
	variants: {
		intent: {
			default: 'border-foreground text-foreground',
			primary: 'border-primary  text-primary',
			secondary: 'border-secondary text-secondary',
			destructive: 'border-destructive text-destructive'
		},
		variant: {
			full: 'border-2 bg-background',
			outline: 'border-2 bg-background',
			fixed: 'border-2',
			ghost: 'border-0'
		},
		size: {
			xs: 'text-sm px-2 py-0.5 [&_svg]:h-4',
			sm: 'text-base px-3 py-1 [&_svg]:h-5',
			md: 'text-xl px-3 py-1 [&_svg]:h-6',
			lg: 'text-2xl px-3 py-1 [&_svg]:h-12',
			icon: 'w-8 h-8'
		}
	},

	defaultVariants: {
		intent: 'default',
		variant: 'outline',
		size: 'md'
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
