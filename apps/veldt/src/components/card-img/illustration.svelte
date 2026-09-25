<script lang="ts">
	import type { Illustration } from '@card-confluence/wasm-browser';
	import ErrorInner from './error-inner.svelte';
	import type { CardActionProps } from './index.svelte';

	export type IllustrationProps = {
		illustration: Illustration;
		alt: string;
	};

	const { illustration, alt, href, onclick }: IllustrationProps & CardActionProps = $props();

	const uris = $derived(illustration.image_uris);
	const image_uri = $derived(uris?.normal ?? uris?.large ?? uris?.small ?? uris?.png);

	let loaded = $state(false);
</script>

{#if image_uri}
	<div
		class={`pointer-events-none absolute h-full w-full bg-[#17150f] p-2 transition-opacity duration-100 ${loaded ? 'opacity-0' : 'opacity-100'}`}
	>
		<div class="h-full w-full rounded-[3.5%/2.5%] bg-white/10"></div>
	</div>

	<svelte:element
		this={href ? 'a' : 'button'}
		class="block"
		{href}
		{onclick}
		role={href ? 'link' : undefined}
	>
		<img
			class="w-full"
			{alt}
			src={image_uri}
			onload={async (e) => {
				try {
					await (e.currentTarget as HTMLImageElement).decode();
				} catch {
					//
				} finally {
					loaded = true;
				}
			}}
		/>
	</svelte:element>
{:else}
	<ErrorInner message={`failed to find image. ${alt}`} />
{/if}
