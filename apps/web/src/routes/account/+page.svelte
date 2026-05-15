<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<div class="flex items-center justify-center">
	<div class="w-full max-w-md space-y-4 rounded-lg p-8 text-center shadow-xl">
		<h1 class="text-2xl font-bold">Account Info</h1>
		<div class="space-y-2">
			<p><span class="text-gray-400">Name:</span> {data.user.name}</p>
			<p><span class="text-gray-400">Email:</span> {data.user.email}</p>
		</div>
		<a href={resolve('/decks')} class="bloc mt-4 hover:underline">Back to Decks</a>
	</div>
</div>
