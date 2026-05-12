<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

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
		<h1 class="text-center text-2xl font-bold">Sign In</h1>
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
					class="mt-1 w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
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
					class="mt-1 w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
				/>
			</div>
			<button
				type="submit"
				disabled={loading}
				class="w-full border-2 bg-white p-1 text-black hover:border-white hover:bg-black hover:text-white disabled:opacity-50"
			>
				{loading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
		<p class="text-center text-sm text-gray-400">
			Don't have an account? <a href={resolve('/signup')} class="text-white hover:underline"
				>Sign Up</a
			>
		</p>
	</div>
</div>
