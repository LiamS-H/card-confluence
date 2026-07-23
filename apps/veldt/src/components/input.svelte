<script lang="ts">
	import { autoFocus } from '$lib/actions/auto-focus';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		autoFocus?: boolean;
	}

	const { autoFocus: focus, ...props }: Props = $props();
</script>

<input
	{...props}
	use:autoFocus={focus}
	class="border-x-0 border-t-0 border-b-2 border-foreground bg-transparent p-0 text-2xl focus:border-primary focus:text-primary focus:ring-0 focus:outline-none"
/>
