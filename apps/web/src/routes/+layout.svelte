<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import './layout.css';

	let { children, data: _ } = $props();

	const session = authClient.useSession();

	async function signOut() {
		await authClient.signOut();
		await goto(resolve('/signin'));
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="flex items-center justify-between px-2 py-1 shadow-md">
	<a href={resolve('/')} class="text-xl font-bold">Karoo.to</a>
	<nav class="flex items-center gap-4">
		{#if $session.data}
			<a href={resolve('/account')} class="hover:underline">{$session.data.user.name}</a>
			<button
				onclick={signOut}
				class="border border-red-600 px-3 py-1 text-sm font-medium text-red-600 transition hover:bg-red-600 hover:text-black"
			>
				Sign Out
			</button>
		{:else if !$session.isPending}
			<a href={resolve('/signin')} class="hover:underline"> Sign In </a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>
