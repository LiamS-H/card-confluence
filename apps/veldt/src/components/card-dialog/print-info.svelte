<script lang="ts">
	import { type DetailedCard } from '$lib';
	import * as Accordion from '$components/ui/accordion';
	import OracleText from '$components/oracle-text.svelte';
	import OracleSpan from '$components/oracle-span.svelte';

	const { card, print_index }: { card: DetailedCard; print_index: number } = $props();

	const active_print = $derived(card.prints[print_index]);
</script>

<div
	class="flex h-full scrollbar-gutter-stable flex-col items-center gap-2 overflow-y-auto md:flex-row md:items-start"
>
	<Accordion.Root type="multiple">
		{const faces = card.card_faces ?? [card]}
		{#each faces as face, i}
			<Accordion.Item value={`face-${i}`}>
				<Accordion.Trigger>
					<div class="flex w-full flex-col-reverse justify-between gap-1 md:flex-row md:gap-0">
						<div>
							{#if active_print.flavor_name && active_print.flavor_name !== face.name}
								<h2 class="text-lg leading-none font-semibold">
									{active_print.flavor_name}
								</h2>
								<span class="text-md text-muted-foreground">
									({face.name})
								</span>
							{:else}
								<h2 class="text-lg leading-none font-semibold">
									{face.name}
								</h2>
							{/if}
							<span class="font-thin text-muted-foreground">
								{face.type_line}
							</span>
						</div>
						<OracleSpan text={face.mana_cost ?? ''} />
					</div>
				</Accordion.Trigger>
				<Accordion.Content>
					<OracleText text={face.oracle_text ?? ''} />
				</Accordion.Content>
			</Accordion.Item>
		{/each}
		{#if card.prints.length == 1}
			{#each card.prints as print}
				{const price = print.prices.usd ? `${print.prices.usd}` : (print.prices.tix ?? '')}
				{const selected = print.scryfall_id === active_print.scryfall_id}
				<div class={`flex w-full flex-wrap justify-between`}>
					<div class="flex items-center gap-2 capitalize">
						<span
							class={`"max-w-44" sm:max-w-44 md:max-w-32 lg:max-w-96  ${selected ? 'truncate group-hover:underline' : ''}`}
						>
							{print.set_code}
						</span>
						<span class="font-thin">
							({print.set_code.toUpperCase()})
						</span>
						<div class="flex gap-1"></div>
					</div>
					<div class="flex gap-2">
						<span class="truncate">{price}</span>
					</div>
				</div>
			{/each}
		{:else}
			<Accordion.Item value="Printings"></Accordion.Item>
		{/if}
		{#if card.all_parts && card.all_parts.length > 1}
			<Accordion.Item value="Related Cards"></Accordion.Item>
		{/if}
		<Accordion.Item value="Legalities"></Accordion.Item>
		<Accordion.Item value="Rulings"></Accordion.Item>
		<Accordion.Item value="Tags"></Accordion.Item>
	</Accordion.Root>
</div>
