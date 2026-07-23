<script lang="ts">
	import { authClient } from '$lib';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$components/button.svelte';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let error = $state('');
	let loading = $state(false);

	async function signup() {
		loading = true;
		error = '';
		const { data: _, error: signupError } = await authClient.signUp.email({
			email,
			password,
			name
		});

		if (signupError) {
			error = signupError.message || 'An error occurred during signup';
		} else {
			await goto(resolve('/account'));
		}
		loading = false;
	}
</script>

<div class="flex items-center justify-center">
	<div class="w-full max-w-md space-y-4 border-2 border-white p-8">
		<h1 class="text-center text-2xl font-bold">Create Account</h1>

		{#if error}
			<div class="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				signup();
			}}
			class="space-y-4"
		>
			<div>
				<label for="name" class="block text-sm font-medium">Username</label>
				<input
					type="text"
					id="username"
					bind:value={name}
					required
					autocomplete="username"
					class="w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
				/>
			</div>
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
					autocomplete="new-password"
					class="w-full border border-white bg-black px-3 py-2 focus:ring-2 focus:ring-white focus:outline-none"
				/>
			</div>
			<Button
				width="full"
				size="lg"
				variant="full"
				type="submit"
				intent="primary"
				disabled={loading}
			>
				{loading ? 'Creating account...' : 'Sign Up'}
			</Button>
		</form>
		<p class="text-center text-sm text-gray-400">
			Already have an account? <a href={resolve('/login')} class="text-white hover:underline"
				>Log In</a
			>
		</p>
	</div>
</div>
