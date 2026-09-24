import { type VariantProps, tv } from 'tailwind-variants';
import { type WithElementRef } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';

export const inputVariants = tv({
	base: 'border-x-0 border-t-0 p-0 border-b-2 border-foreground bg-transparent p-0 text-2xl outline-none  focus:ring-0',
	variants: {
		intent: {
			primary: 'focus:border-primary focus:text-primary focus:placeholder-primary/50',
			secondary: 'focus:border-secondary focus:text-secondary focus:placeholder-secondary/50'
		},
		variant: {
			underline: 'border-b-2',
			outline: 'border-2'
		},
		size: {
			xs: 'text-base',
			sm: 'text-xl',
			md: 'text-2xl',
			lg: 'text-3xl'
		}
	},

	defaultVariants: {
		intent: 'primary',
		variant: 'underline',
		size: 'md'
	}
});

export type InputVariants = VariantProps<typeof inputVariants>;

export type InputProps = WithElementRef<HTMLInputAttributes> & {
	focus?: boolean;
	intent?: InputVariants['intent'];
	variant?: InputVariants['variant'];
	size?: InputVariants['size'];
};
