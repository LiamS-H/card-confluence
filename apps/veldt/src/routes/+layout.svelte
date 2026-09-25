<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './tailwind.css';
	import Navbar from './navbar.svelte';

	let { children, data: _ } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="grid min-h-dvh grid-rows-[auto_1fr] bg-background text-foreground">
	<header class="sticky top-0 z-20 bg-background">
		<Navbar />
	</header>

	<main>
		{@render children()}
	</main>
</div>
