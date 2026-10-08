<script lang="ts">
	import Settings from '$components/settings/settings.svelte';
	import { Button } from '$components/ui/button';
	import * as Dialog from '$components/ui/dialog';
	import { page } from '$app/state';

	let is_open = $state(false);

	function get_on_settings() {
		return page.url.pathname.startsWith('/settings');
	}

	const on_settings_page = $derived(get_on_settings());
</script>

<Dialog.Root
	bind:open={
		() => is_open,
		(o) => {
			if (get_on_settings()) {
				is_open = false;
			} else {
				is_open = o;
			}
		}
	}
>
	<Dialog.Trigger>
		<Button size="md" intent="secondary" variant={is_open || on_settings_page ? 'fixed' : 'outline'}
			>settings</Button
		>
	</Dialog.Trigger>
	<Dialog.Content class="h-fit max-h-11/12 w-full max-w-3xl min-w-48 p-0 sm:min-w-xl md:min-w-3xl">
		<Dialog.Header class="p-3">
			<Dialog.Title>Quick Settings</Dialog.Title>
			<Dialog.Description class="sr-only">make quick edits to your settings.</Dialog.Description>
		</Dialog.Header>
		<div class="p-3">
			<Settings />
		</div>
		<Dialog.Footer>
			<Button intent="secondary" href="/settings" onclick={() => (is_open = false)}
				>full settings</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
