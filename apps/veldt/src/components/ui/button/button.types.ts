import { type VariantProps, tv } from 'tailwind-variants';
import { type WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';

export const buttonVariants = tv({
	base: 'group relative overflow-hidden transition-colors aria-disabled:opacity-50 aria-disabled:pointer-events-none',
	variants: {
		intent: {
			default: 'border-foreground text-foreground',
			primary: 'border-primary  text-primary',
			secondary: 'border-secondary text-secondary',
			destructive: 'border-destructive text-destructive'
		},
		variant: {
			full: 'border-2',
			outline: 'border-2',
			fixed: 'border-2',
			ghost: 'border-0'
		},
		size: {
			xs: 'text-sm px-2 py-0.5',
			sm: 'text-base px-3 py-1',
			md: 'text-xl px-3 py-1',
			lg: 'text-2xl px-3 py-1',
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
