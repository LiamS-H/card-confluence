<script lang="ts">
	import { inputVariants, type InputProps } from './input.type.ts';
	import { cn } from '$lib/utils.js';
	import { autoFocus } from '$lib/actions/auto-focus';
	let {
		class: className,
		'data-slot': dataSlot = 'input',
		intent,
		variant,
		size,
		ref = $bindable(null),
		type = 'button',
		disabled,
		focus,
		value = $bindable(),
		...restProps
	}: InputProps = $props();
</script>

<input
	bind:this={ref}
	bind:value
	class={cn(inputVariants({ intent, variant, size }), className)}
	data-slot={dataSlot}
	tabindex={disabled ? -1 : undefined}
	{disabled}
	{...restProps}
	use:autoFocus={focus}
/>
