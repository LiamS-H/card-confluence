<script lang="ts">
	// TODO: lots of cleaup to this:
	// replace basic inputs with the same input as the title from the deck
	import { get_local_settings, set_local_settings } from '$lib/local-settings.svelte';
	import { use_config } from '$lib/sync/use-config.svelte';
	import { Button } from '$components/ui/button';
	import DbStatus from '$components/db-status.svelte';
	import Templates from './templates.svelte';

	const localSettings = get_local_settings();
	const configState = use_config();

	const card_variant_options = ['img', 'tile'] as const;
</script>

<div class="flex h-full flex-col space-y-8 p-4">
	<section>
		<h2 class="mb-4 text-xl font-bold">Local Settings</h2>
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<span class="text-lg font-medium">Card Data Location:</span>
				<DbStatus />
			</div>

			<div class="flex items-center gap-2">
				<span class="text-lg font-medium"></span>
				<div class="flex gap-2">
					{#each card_variant_options as option}
						{const active = $derived(option === localSettings.cards.variant)}
						<Button
							intent={active ? 'primary' : 'default'}
							variant={active ? 'fixed' : 'outline'}
							onclick={() => set_local_settings({ ...localSettings, cards: { variant: option } })}
						>
							{option}
						</Button>
					{/each}
				</div>
			</div>
		</div>
	</section>
	<Templates />
</div>
