<script lang="ts">
	import { use_deck_edit } from '$lib/editor';
	import { Button } from '$components/ui/button';

	import * as Popover from '$components/ui/popover';
	import { untrack } from 'svelte';

	const deck = use_deck_edit();

	let is_open = $state(false);

	let opened_view: string | null = $state(null);
	$effect(() => {
		const open = is_open;
		untrack(() => {
			if (open) {
				opened_view = deck.active_view;
			} else {
				opened_view = null;
			}
		});
	});

	function get_open() {
		return is_open;
	}

	function on_external_open(o: boolean) {
		if (opened_view && !o) deck.set_active_view(opened_view);
		is_open = o;
	}

	const view = $derived(opened_view ?? deck.active_view);
</script>

<Popover.Root bind:open={get_open, on_external_open}>
	<Popover.Trigger
		intent="secondary"
		variant={is_open ? 'fixed' : 'outline'}
		class="pointer-events-auto w-64"
	>
		view: {view}
	</Popover.Trigger>
	<Popover.Content class="w-fit">
		<ul class="flex flex-col -space-y-1">
			{#each deck.view_ids as view_option}
				<li>
					<Button
						intent="secondary"
						class="w-64"
						onmouseenter={() => {
							deck.set_active_view(view_option);
						}}
						onmouseleave={() => {
							deck.set_active_view(opened_view ?? deck.active_view);
						}}
						onclick={() => {
							deck.set_active_view(view_option);
							is_open = false;
						}}
					>
						{view_option}
					</Button>
				</li>
			{/each}
		</ul>
	</Popover.Content>
</Popover.Root>
