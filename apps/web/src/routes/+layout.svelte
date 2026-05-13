<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';
	import Navbar from './navbar.svelte';

	let { children, data: _ } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header>
	<Navbar />
</header>

<main>
	{@render children()}
</main>
