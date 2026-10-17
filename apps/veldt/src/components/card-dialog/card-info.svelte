<script lang="ts" module>
	let value = $state<string[]>(['face-0', 'face-1']);
</script>

<script lang="ts">
	import { type DetailedCard } from '$lib';
	import * as Accordion from '$components/ui/accordion';
	import OracleText from '$components/oracle-text.svelte';
	import OracleSpan from '$components/oracle-span.svelte';
	import { Gavel, Check, Link2, Close } from '@material-symbols-svg/svelte/sharp';
	import {
		price_from_print,
		rulings_grouped,
		legalities_as_short_sorted,
		card_as_json
	} from '$lib/card-confluence/utils';
	import { uuid_to_string } from '$lib/utils/uuid';
	import CopyButton from '$components/copy-button.svelte';
	import Json from '$components/json.svelte';
	import { Button } from '$components/ui/button';

	const { card, print_index }: { card: DetailedCard; print_index: number } = $props();

	const active_print = $derived(card.prints[print_index] ?? null);
</script>

{#snippet printing({ print }: { print: DetailedCard['prints'][number] })}
	{const selected = print.scryfall_id === active_print?.scryfall_id}
	<div class={`group flex w-full flex-wrap justify-between px-2`}>
		<div
			class={`flex flex-1 items-center gap-2 capitalize ${selected ? 'text-muted-foreground' : ''}`}
		>
			<span
				class={`max-w-44 truncate sm:max-w-44 md:max-w-32 lg:max-w-96 ${selected ? '' : 'truncate group-hover:underline'}`}
			>
				{print.set.name}
			</span>
			<span class="font-thin">
				({print.set_code.toUpperCase()})
			</span>
		</div>
		<div class="flex gap-2">
			<span class="truncate">{price_from_print(print)}</span>
		</div>
	</div>
{/snippet}

<Accordion.Root bind:value type="multiple">
	{const faces = card.card_faces ?? [card]}
	{#each faces as face, i}
		<Accordion.Item value={`face-${i}`}>
			<Accordion.Trigger>
				<div class="flex w-full flex-col-reverse justify-between gap-1 md:flex-row md:gap-0">
					<div>
						{#if active_print !== null && active_print.flavor_name && active_print.flavor_name !== face.name}
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
			<Accordion.Content class="px-3">
				<OracleText text={face.oracle_text ?? ''} />
			</Accordion.Content>
		</Accordion.Item>
	{/each}

	<Accordion.Item value="Printings" disabled={card.prints.length <= 1 && active_print !== null}>
		<Accordion.Trigger class="group flex gap-2 hover:no-underline"
			><span class="group-hover:underline">Printings</span>
			{#if active_print !== null}
				{@render printing({ print: active_print })}
			{/if}
		</Accordion.Trigger>
		<Accordion.Content>
			{#each card.prints as print}
				{@render printing({ print })}
			{/each}
		</Accordion.Content>
	</Accordion.Item>
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
			<ul class="flex w-fit max-w-64 flex-row flex-wrap px-2 sm:max-w-full lg:max-h-36 lg:flex-col">
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
	<Accordion.Item value="Rulings" disabled={!card.rulings}>
		<Accordion.Trigger>
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
					<CopyButton intent="secondary" class="pr-0 pl-1" variant="full" size="xs" text={tag}>
						{tag}
					</CopyButton>
				{/each}
			</ul>
		</Accordion.Content>
	</Accordion.Item>
	<Accordion.Item value="json">
		<Accordion.Trigger>JSON</Accordion.Trigger>
		<Accordion.Content class="relative">
			{const json = $derived(card_as_json({ ...card, prints: active_print ? [active_print] : [] }))}
			{const full_json = $derived(card_as_json(card))}
			<div class="absolute top-0 right-4 flex">
				<span
					class="flex h-10 items-center justify-center bg-foreground px-3 text-xl text-background"
				>
					{active_print
						? `${active_print.flavor_name ?? card.name} ${active_print.set.code.toUpperCase()}`.toLowerCase()
						: 'oracle'}
				</span>
				<CopyButton text={json}>copy</CopyButton>
				<CopyButton text={full_json}>copy full</CopyButton>
				<Button href={`/json/${uuid_to_string(card.oracle_id)}`}>json-full-page</Button>
			</div>
			<Json {json} />
		</Accordion.Content>
	</Accordion.Item>
</Accordion.Root>
