<script lang="ts">
	import { query_client } from '$lib';
	import Button from '$components/button.svelte';
	import { get_veldt_settings, set_veldt_settings } from '$lib/settings.svelte';
	import { clickOutside } from '$lib/actions/click-outside';

	const status = $derived(query_client.db_status);

	let open = $state(false);

	const settings = get_veldt_settings();

	function set_local(useLocal: boolean) {
		set_veldt_settings({
			...settings,
			database: { ...settings.database, useLocal }
		});
	}
</script>

<div class="relative">
	<div class="flex">
		<Button onclick={() => (open = !open)} intent="secondary" variant={open ? 'fixed' : 'outline'}>
			{status.data} data
		</Button>
		<Button
			onclick={() => (open = !open)}
			intent="secondary"
			variant="fixed"
			disabled={status.state !== 'ready'}
		>
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
	<div
		class="absolute z-200 flex w-full flex-col bg-secondary"
		class:hidden={!open}
		use:clickOutside={() => (open = false)}
	>
		<div class="h-full w-full p-0.5 pt-0">
			<div class="flex h-full w-full flex-col gap-2 bg-background p-2">
				<span class="w-full text-xl">Database Settings - {status.data}</span>
				{#if status.data === 'local'}
					{#if !settings.database.useLocal}
						<span class="text-destructive">Unable to connect to remote.</span>
					{/if}
					<span> You are using the recommended local database. </span>

					<span> This gives you offline access, as well as the fastest queries. </span>
					<span> When new database versions come out they will be downloaded automatically. </span>
					<span> This uses ~260mb</span>
				{:else if settings.database.useLocal}
					<span class="text-primary">Local database downloading...</span>
					<span>
						While the database is downloaded you can still query against the remote database.</span
					>
				{:else}
					<span> You are not using the recommended local version of the database. </span>
					<span>
						The local version downloads ~260mb of data to your machine, and allows much faster
						queries.
					</span>
					<span> This has the added benefit of making the app work offline </span>
				{/if}

				{#if settings.database.useLocal}
					<Button
						onclick={() => {
							open = false;
							set_local(false);
						}}
						intent="destructive">prefer remote</Button
					>
				{:else}
					<Button
						onclick={() => {
							open = false;
							set_local(true);
						}}
						intent="secondary">go local</Button
					>
				{/if}
			</div>
		</div>
		<div class="flex justify-between"></div>
	</div>
</div>
