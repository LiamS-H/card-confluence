<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';

	let { ...restProps }: PopoverPrimitive.PortalProps = $props();
</script>

<PopoverPrimitive.Portal {...restProps} />

<!-- <PopoverPrimitive.Portal {...restProps}>
	<PopoverPrimitive.Overlay
		class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/20 blur-2xl"
	/>
	{@render children?.()}
</PopoverPrimitive.Portal> -->
