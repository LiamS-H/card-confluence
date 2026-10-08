<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { Button, type ButtonProps } from '$components/ui/button';

	let {
		ref = $bindable(null),
		class: className,
		child: child_comp,
		children,
		...restProps
	}: PopoverPrimitive.TriggerProps & ButtonProps = $props();
</script>

<PopoverPrimitive.Trigger bind:ref data-slot="popover-trigger" {...restProps}>
	{#snippet child({ props })}
		{#if child_comp}
			{@render child_comp({ props })}
		{:else}
			<Button {...props}>
				{@render children?.()}
			</Button>
		{/if}
	{/snippet}
</PopoverPrimitive.Trigger>
