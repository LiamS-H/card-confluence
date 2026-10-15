<script lang="ts">
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { Button } from '$components/ui/button';

	import * as Popover from '$components/ui/popover';
	import { untrack } from 'svelte';

	const deck = use_deck_cards();

	let is_open = $state(false);

	let opened_index: number | null = $state(null);
	$effect(() => {
		const open = is_open;
		untrack(() => {
			if (open) {
				opened_index = deck.active_view;
			} else {
				opened_index = null;
			}
		});
	});

	function get_open() {
		return is_open;
	}

	function on_external_open(o: boolean) {
		if (opened_index && !o) deck.set_active_view(opened_index);
		is_open = o;
	}

	const view = $derived(deck.doc_state.parsed.views[opened_index ?? deck.active_view]);
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
			{#each deck.doc_state.parsed.views as view_option, index}
				<li>
					<Button
						intent="secondary"
						class="w-64"
						onmouseenter={() => {
							deck.set_active_view(index);
						}}
						onmouseleave={() => {
							deck.set_active_view(opened_index ?? 0);
						}}
						onclick={() => {
							deck.set_active_view(index);
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
