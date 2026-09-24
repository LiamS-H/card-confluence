<script lang="ts">
	import type { Illustration as IIllustration } from '@card-confluence/wasm-browser';
	import Illustration from './illustration.svelte';
	import { Button } from '$components/ui/button';
	import { Flip } from '@material-symbols-svg/svelte/sharp';
	import type { CardActionProps } from './index.svelte';

	const {
		illustrations,
		alt,
		href,
		onclick
	}: { illustrations: IIllustration[]; alt: string } & CardActionProps = $props();
	let face = $state(0);

	function next_face() {
		face = (face + 1) % illustrations.length;
	}
</script>

<Button class="absolute top-2 right-2" variant="ghost" onclick={next_face} size="icon">
	<Flip />
</Button>

<svelte:element this={href ? 'a' : 'button'} {href} {onclick} role={href ? 'link' : undefined}>
	<Illustration illustration={illustrations[face]} {alt} />
</svelte:element>
