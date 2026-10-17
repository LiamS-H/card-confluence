<script lang="ts">
	import { page } from '$app/state';
	import { use_card } from '$lib';
	import { string_to_uuid } from '$lib/utils/uuid';
	import CardJson from './card-json.svelte';

	const [uuid, uuid_error] = $derived.by(() => {
		const uuid_string = page.params.card;
		if (!uuid_string) {
			return [null, 'no card uuid provided'];
		}
		const uuid = string_to_uuid(uuid_string);
		if (!uuid) {
			return [null, 'invalid uuid'];
		}
		return [uuid, null];
	});
	const query = $derived(uuid ? use_card(() => uuid) : null);
</script>

{#if !query}
	<span>{uuid_error}</span>
{:else}
	{#if query.card.loading}
		<span>loading...</span>
	{:else if query.card.error}
		<span>{query.card.error}</span>
	{:else}
		<CardJson card={query.card.result} />
	{/if}
{/if}
