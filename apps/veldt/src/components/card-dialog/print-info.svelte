<script lang="ts">
	// TODO: make this accept null as print_index, could be used for minimal db version that doesn't download print info at all
	// combine with dialog not using unused card info
	import { type DetailedCard } from '$lib';
	import * as Accordion from '$components/ui/accordion';
	import { Button } from '$components/ui/button';
	import OracleText from '$components/oracle-text.svelte';
	import OracleSpan from '$components/oracle-span.svelte';
	import { Gavel, Check, Link2, Close } from '@material-symbols-svg/svelte/sharp';
	import {
		price_from_print,
		rulings_grouped,
		legalities_as_short_sorted
	} from '$lib/card-confluence/utils';

	const { card, print_index }: { card: DetailedCard; print_index: number } = $props();

	const active_print = $derived(card.prints[print_index]);
</script>

<div class="flex h-full flex-col items-center gap-2 overflow-y-auto md:flex-row md:items-start">
	<Accordion.Root type="multiple">
		{const faces = card.card_faces ?? [card]}
		{#each faces as face, i}
			<Accordion.Item value={`face-${i}`}>
				<Accordion.Trigger>
					<div class="flex w-full flex-col-reverse justify-between gap-1 pl-3 md:flex-row md:gap-0">
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
		{#if card.prints.length >= 1}
			<Accordion.Item value="Printings">
				<Accordion.Trigger>Printings</Accordion.Trigger>
				<Accordion.Content>
					{#each card.prints as print}
						{const selected = print.scryfall_id === active_print.scryfall_id}
						<div class={`group flex w-full flex-wrap justify-between`}>
							<div class="flex flex-1 items-center gap-2 capitalize">
								<span
									class={`max-w-44 truncate sm:max-w-44 md:max-w-32 lg:max-w-96 ${selected ? '' : 'truncate group-hover:underline'}`}
								>
									{print.set.name}
								</span>
								<span class="font-thin">
									({print.set_code.toUpperCase()})
								</span>
								<div class="flex gap-1"></div>
							</div>
							<div class="flex gap-2">
								<span class="truncate">{price_from_print(active_print)}</span>
							</div>
						</div>
					{/each}
				</Accordion.Content>
			</Accordion.Item>
		{:else}
			<div class={`flex w-full flex-wrap justify-between border-b-foreground`}>
				<div class="flex items-center gap-2 capitalize">
					<span class="flex max-w-44 flex-1 sm:max-w-44 md:max-w-32 lg:max-w-96">
						{active_print.set.name}
					</span>
					<span class="font-thin">
						{active_print.set_code.toUpperCase()}
					</span>
					<div class="flex gap-1"></div>
				</div>
				<div class="flex gap-2">
					<span class="truncate">{price_from_print(active_print)}</span>
				</div>
			</div>
		{/if}
		{#if card.all_parts && card.all_parts.length > 1}
			<Accordion.Item value="Related Cards">
				<Accordion.Trigger>Related Cards</Accordion.Trigger>
				<Accordion.Content>
					<ul class="overflow y-auto my-2 max-h-52">
						{#each card.all_parts as related}
							<button>
								<div class="flex w-full justify-between">
									<div class="flex max-w-44 gap-2 sm:max-w-44 md:max-w-32 lg:max-w-96">
										<span class="truncate">{related.name}</span>
										<span class="truncate font-thin">
											({related.type_line})
										</span>
									</div>
									<span>{related.component}</span>
								</div>
							</button>
						{/each}
					</ul>
				</Accordion.Content>
			</Accordion.Item>
		{/if}
		<Accordion.Item value="Legalities">
			<Accordion.Trigger>Legalities</Accordion.Trigger>
			<Accordion.Content>
				<ul class="flex w-fit max-w-64 flex-row flex-wrap sm:max-w-full lg:max-h-36 lg:flex-col">
					{#each legalities_as_short_sorted(card.legalities) as { format, legality }}
						{#if legality === 'banned'}
							<li class="flex w-32 items-center justify-start text-destructive">
								<Gavel />
								<span>{format}</span>
							</li>
						{:else if legality === 'not_legal'}
							<li class="flex w-32 items-center justify-start text-muted-foreground">
								<Close />
								<span>{format}</span>
							</li>
						{:else if legality === 'restricted'}
							<li class="flex w-32 items-center justify-start text-secondary">
								<Link2 />
								<span>{format}</span>
							</li>
						{:else if legality === 'legal'}
							<li class="flex w-32 items-center justify-start text-primary">
								<Check />
								<span>{format}</span>
							</li>
						{/if}
					{/each}
				</ul>
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="Rulings">
			<Accordion.Trigger disabled={!card.rulings}>
				<span
					>Rulings
					{#if !card.rulings}
						: None
					{/if}
				</span>
			</Accordion.Trigger>
			<Accordion.Content>
				{#if card.rulings}
					<ul class="flex flex-col items-center">
						{const grouped = rulings_grouped(card.rulings)}
						{#each grouped as ruling}
							<li class="p1 flex max-w-96 flex-col items-end">
								<ul class="flex flex-col gap-1">
									{#each ruling.comments as comment}
										<li class="bg-secondary p-2 text-secondary-foreground">
											<OracleText class="px-1 text-left" text={comment} />
										</li>
									{/each}
								</ul>
								<span class="text-muted-foreground uppercase">
									{ruling.published_at}
									{ruling.source}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Accordion.Content>
		</Accordion.Item>
		<Accordion.Item value="Tags">
			{const no_tags = card.otags.length === 0}
			<Accordion.Trigger class="flex w-full items-center">
				<span
					>Tags
					{#if no_tags}
						: None
					{/if}
				</span>
			</Accordion.Trigger>
			<Accordion.Content>
				<ul class="flex flex-wrap gap-1">
					{#each card.otags as tag}
						<li class="flex items-center bg-secondary text-secondary-foreground">
							<span class="px-1 text-left">{tag}</span>
							<Button intent="secondary" variant="full" size="xs">+</Button>
						</li>
					{/each}
				</ul>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>
