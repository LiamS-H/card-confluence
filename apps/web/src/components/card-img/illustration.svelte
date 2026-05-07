<script lang="ts">
	import type { Illustration } from 'wasm-browser';
	import Error from './error.svelte';

	export type IllustrationProps = {
		illustration: Illustration;
		alt: string;
	};

	const { illustration, alt }: IllustrationProps = $props();

	const uris = $derived(illustration.image_uris);
	const image_uri = $derived(uris?.small ?? uris?.normal ?? uris?.large ?? uris?.png);
</script>

{#if image_uri}
	<img class="block w-full" {alt} src={image_uri} />
{:else}
	<Error message={`failed to find image. ${alt}`} />
{/if}
