<script lang="ts">
	import { authClient } from '$lib';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$components/button.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function signin() {
		loading = true;
		error = '';
		const { data: _, error: signinError } = await authClient.signIn.email({
			email,
			password
		});

		if (signinError) {
			error = signinError.message || 'Invalid email or password';
		} else {
			await goto(resolve('/account'));
		}
		loading = false;
	}
</script>

<div class="flex items-center justify-center">
	<div class="w-full max-w-md space-y-4 border-2 border-white p-8">
		<h1 class="text-center text-2xl font-bold">Existing Account</h1>
		{#if error}
			<div class="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				signin();
			}}
			class="space-y-4"
		>
			<div>
				<label for="email" class="block text-sm font-medium">Email</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					autocomplete="email"
					class="w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
				/>
			</div>
			<div>
				<label for="password" class="block text-sm font-medium">Password</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					autocomplete="current-password"
					class="w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
				/>
			</div>
			<Button type="submit" size="full" variant="full" disabled={loading}>
				{loading ? 'Loading' : 'Log In'}
			</Button>
		</form>
		<p class="text-center text-sm text-gray-400">
			Don't have an account? <a
				href={resolve('/signup')}
				class="text-white hover:text-primary hover:underline">Sign Up</a
			>
		</p>
	</div>
</div>
