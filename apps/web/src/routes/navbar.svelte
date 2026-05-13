<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { type Pathname } from '$app/types';
	import Button from '$components/button.svelte';

	import { authClient } from '$lib';
	const session = authClient.useSession();

	async function signOut() {
		await authClient.signOut();
	}

	function match(path: string, path2: Pathname) {
		if (path2 === '/') {
			return path === path2;
		}
		if (path === path2) {
			return true;
		}
		if (path.startsWith(path2)) {
			return true;
		}
		return false;
	}
</script>

{#snippet navItem({
	label,
	path,
	intent
}: {
	label: string;
	intent?: 'default' | 'primary' | 'secondary' | 'destructive';
	path: Pathname;
})}
	<li>
		<a href={resolve(path)}>
			<Button {intent} size="small" variant={match(page.url.pathname, path) ? 'fixed' : 'outline'}>
				{label}
			</Button>
		</a>
	</li>
{/snippet}

<nav class="sticky top-0 flex h-10 w-full items-center justify-between pr-px">
	<a href={resolve('/')} class="ml-1 text-2xl font-bold">karoo.to</a>
	<ul class="flex">
		{#each [{ label: 'decks', path: '/decks' }] as const as route (route)}
			{@render navItem(route)}
		{/each}
		{#if $session.data}
			{@render navItem({ label: $session.data.user.name, path: '/account', intent: 'secondary' })}
			<li>
				<Button size="small" intent="destructive" onclick={signOut}>logout</Button>
			</li>
		{:else if !$session.isPending}
			{#each [{ label: 'login', path: '/login' }, { label: 'signup', path: '/signup', intent: 'primary' }] as const as route (route)}
				{@render navItem(route)}
			{/each}
		{/if}
	</ul>
</nav>
