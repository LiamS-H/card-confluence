<script lang="ts">
	import type { Illustration } from 'wasm-browser';
	import Error from './error.svelte';

	export type IllustrationProps = {
		illustration: Illustration;
		alt: string;
	};

	const { illustration, alt }: IllustrationProps = $props();

	const uris = $derived(illustration.image_uris);
	const image_uri = $derived(uris?.normal ?? uris?.large ?? uris?.small ?? uris?.png);

	let loaded = $state(false);
</script>

{#if image_uri}
	<div
		class={`absolute h-full w-full bg-[#17150f] p-2 transition-opacity duration-100 ${loaded ? 'opacity-0' : 'opacity-100'}`}
	>
		<div class="h-full w-full rounded-[3.5%/2.5%] bg-white/10"></div>
	</div>
	<img
		class="block w-full"
		{alt}
		src={image_uri}
		onload={async (e) => {
			try {
				await e.currentTarget.decode();
			} catch {
				//
			} finally {
				loaded = true;
			}
		}}
	/>
{:else}
	<Error message={`failed to find image. ${alt}`} />
{/if}
