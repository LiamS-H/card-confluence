<script lang="ts">
	import { type ButtonProps, buttonVariants } from './button.types.ts';
	import { cn } from '$lib/utils.js';
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

	const spanTranslate = $derived.by(() => {
		switch (variant) {
			case 'fixed': {
				return 'translate-x-0';
			}
			case 'full': {
				return 'translate-x-0 group-hover:translate-x-full';
			}
			default: {
				return '-translate-x-full group-hover:translate-x-0';
			}
		}
	});
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
		class={`${bgMap[intent ?? 'default']} ${spanTranslate} absolute inset-y-0 left-[-10%] z-0
            w-[120%] skew-x-12 transition-transform duration-300`}
	></span>
	<span class="item-center relative z-10 flex justify-center mix-blend-difference">
		{@render children()}
	</span>
</svelte:element>
