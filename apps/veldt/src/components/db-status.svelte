<script lang="ts">
	import { query_client } from '$lib';
	import Button from '$components/button.svelte';
	// Status will show the current age of the data local or remote
	// When data is remove the db icon will be info variant and open the popup. use local button
	// When data is local the db icon will have a check mark and open the popup. synced button

	// Popup for downloading new db, middle button is ask every time, with right button being proceed do not show again,
	// must make sure that certain db calls will properly clear popup
	const status = $derived(query_client.db_status);
</script>

<div class="relative">
	<div class="flex">
		<div class="flex items-center bg-secondary px-3 text-xl text-background">
			{status.data} engine
		</div>
		<Button intent="secondary" disabled={status.state !== 'ready'}>
			{#if status.state !== 'ready'}
				{status.state}
			{:else}
				{const prints = status.metadata.sources.find((s) => s.table === 'prints')}
				{#if !prints}
					Invalid ISO
				{:else}
					{const days_old = Math.floor(
						(Date.now() - new Date(prints.iso).getTime()) / (1000 * 60 * 60 * 24)
					)}
					{#if days_old === 0}
						less than a day
					{:else if days_old === 1}
						yesterday
					{:else}
						{days_old} days ago
					{/if}
				{/if}
			{/if}
		</Button>
	</div>
</div>
