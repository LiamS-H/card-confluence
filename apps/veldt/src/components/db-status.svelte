<script lang="ts">
	import { query_client } from '$lib';
	import { Button } from '$components/ui/button';
	import { get_local_settings, set_local_settings } from '$lib/settings';
	import * as Popover from '$components/ui/popover';
	import * as Card from '$components/ui/card';

	const status = $derived(query_client.db_status);

	let isOpen = $state(false);

	const settings = get_local_settings();

	function set_local(useLocal: boolean) {
		set_local_settings({
			...settings,
			database: { ...settings.database, useLocal }
		});
	}

	function set_in_memory(inMemory: boolean) {
		set_local_settings({
			...settings,
			database: { ...settings.database, inMemory }
		});
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="secondary"
				variant={isOpen ? 'fixed' : 'outline'}
				onclick={() => (isOpen = !isOpen)}
			>
				{#if status.state === 'downloading'}
					downloading {status.downloaded}/{status.total}
				{:else}
					{status.data}
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80">
		<Card.Root intent={'secondary'}>
			<Card.Body>
				<span class="w-full text-xl">Current Data - {status.data} </span>

				{#if status.state !== 'ready'}
					<span class="-mt-1 w-full text-primary/50">
						{status.state}
					</span>
				{:else}
					{const prints = status.metadata.sources.find((s) => s.table === 'prints')}
					{#if !prints}
						<span class="-mt-1 w-full text-destructive/50"> Invalid ISO Timestamp </span>
					{:else}
						<span class="-mt-1 w-full text-foreground/50"
							>Card updated
							{const days_old = Math.floor(
								(Date.now() - new Date(prints.iso).getTime()) / (1000 * 60 * 60 * 24)
							)}
							{#if days_old <= 0}
								less than a day ago.
							{:else if days_old === 1}
								yesterday.
							{:else}
								{days_old} days ago.
							{/if}
						</span>
					{/if}
				{/if}
				{#if status.data === 'local'}
					{#if !settings.database.useLocal}
						<span class="text-destructive">Unable to connect to remote.</span>
					{/if}
					<span> You are using the recommended local database. </span>

					<span> This gives you offline access, as well as the fastest queries. </span>
					<span> When new database versions come out they will be downloaded automatically. </span>
					<span> This uses ~200mb of storage on your device, and ~0.5GB RAM memory.</span>
					{#if settings.database.inMemory}
						<span class="text-primary">
							You are using the fastest DB version, which comes with increased ram usage.</span
						>
					{:else}
						<span>
							You can unlock even faster queries by decoding the full database into RAM memory, at
							the cost of increased RAM memory usage ~1GB.</span
						>
					{/if}
				{:else if settings.database.useLocal}
					<span class="text-primary">Local database downloading...</span>
					<span>
						While the database is downloaded you can still query against the remote database.</span
					>
				{:else}
					<span class="text-primary">
						You are not using the recommended local version of the database.
					</span>
					<span>
						The local version downloads ~200mb of data to your storage, and allows much faster
						queries.
					</span>
					<span> This has the added benefit of making the app work offline. </span>
				{/if}

				<div class="flex">
					{#if settings.database.useLocal}
						<Button
							onclick={() => {
								set_local(false);
							}}
							intent="secondary">prefer remote</Button
						>

						{#if settings.database.inMemory}
							<Button
								onclick={() => {
									set_in_memory(false);
								}}
								intent="destructive">save mem</Button
							>
						{:else}
							<Button
								onclick={() => {
									set_in_memory(true);
								}}
								intent="primary">use mem</Button
							>
						{/if}
					{:else}
						<Button
							onclick={() => {
								set_local(true);
							}}
							intent="primary">go local</Button
						>
					{/if}
				</div>
			</Card.Body>
		</Card.Root>
	</Popover.Content>
</Popover.Root>
