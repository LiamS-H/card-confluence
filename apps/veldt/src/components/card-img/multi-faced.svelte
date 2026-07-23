<script lang="ts">
	import type { Illustration as IIllustration } from '@card-confluence/wasm-browser';
	import Illustration from './illustration.svelte';

	const { illustrations, alt }: { illustrations: IIllustration[]; alt: string } = $props();
	let face = $state(0);

	function next_face() {
		face = (face + 1) % illustrations.length;
	}
</script>

<button class="absolute top-2 right-2" onclick={next_face}>flip</button>
<Illustration illustration={illustrations[face]} {alt} />
