<script lang="ts">
	import CardWrapper, { type CardSizeProps } from './card-wrapper.svelte';
	import ErrorInner from './error-inner.svelte';

	const { message, ...size }: CardSizeProps & { message: string } = $props();
</script>

<CardWrapper {...size}>
	<ErrorInner {message} />
</CardWrapper>
