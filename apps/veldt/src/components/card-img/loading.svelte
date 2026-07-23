<script lang="ts">
	import CardWrapper from './card-wrapper.svelte';
	import type { CardSizeProps } from './card-wrapper.svelte';

	const size: CardSizeProps = $props();
</script>

<CardWrapper {...size}>
	<div class="h-full w-full bg-[#17150f]"></div>
</CardWrapper>
