<script lang="ts">
	import { use_config } from '$lib/sync/use-config.svelte';
	import {
		createTemplate,
		deleteTemplate,
		updateTemplate,
		type TemplateStruct
	} from '@repo/schema-sync';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import ActiveTemplate from './active-template.svelte';
	import { Close } from '@material-symbols-svg/svelte/sharp';

	const configState = use_config();

	let active_id = $state<string | null>(null);

	let searchQuery = $state('');

	let templates = $derived(configState.configData?.templates || {});
	let filteredTemplates = $derived(
		Object.entries(templates).filter(([_, tpl]) =>
			tpl.title.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function handleNewTemplate() {
		const id = crypto.randomUUID();
		createTemplate(configState.root, id, 'New Template', '');
		active_id = id;
	}

	function handleDuplicate(id: string | null) {
		if (!id) return;
		const tpl = templates[id];
		if (!tpl) return;
		const newId = crypto.randomUUID();
		createTemplate(configState.root, newId, `${tpl.title} (Copy)`, tpl.template);
		active_id = newId;
	}

	function handleDelete(id: string | null) {
		if (!id) return;
		deleteTemplate(configState.root, id);
		if (active_id === id) {
			active_id = null;
		}
	}

	function handleUpdateTitle(id: string | null, e: Event) {
		if (!id) return;
		const val = (e.target as HTMLInputElement).value;
		updateTemplate(configState.root, id, { title: val });
	}
</script>

<section class="flex h-full min-h-0 flex-1 flex-col pb-10">
	<h2 class="mb-4 text-xl font-bold">Templates</h2>
	{#if configState.configData}
		<div class="flex h-full min-h-125 flex-col gap-4 md:flex-row">
			<!-- Sidebar / Tabs -->
			<div class="flex w-full flex-col gap-2 md:w-1/3">
				<div class="flex items-center gap-2">
					<Input type="text" placeholder="Search templates..." bind:value={searchQuery} />
				</div>

				<div
					class="flex h-full min-h-75 flex-1 flex-col gap-1 overflow-y-auto rounded border border-foreground/20 p-2"
				>
					{#each filteredTemplates as [id, tpl] (id)}
						{const active = $derived(id === active_id)}
						<div class="flex h-8">
							<Button
								class="grow border-0"
								intent={active ? 'primary' : 'default'}
								variant={active ? 'fixed' : 'ghost'}
								onclick={() => (active_id = id)}
							>
								{tpl.title || 'Untitled'}
							</Button>
							<Button
								class="border-0"
								intent="destructive"
								variant="fixed"
								size="icon"
								onclick={() => handleDelete(id)}><Close /></Button
							>
						</div>
					{/each}
					{#if filteredTemplates.length === 0}
						<div class="p-2 text-sm text-muted-foreground">No templates found.</div>
					{/if}
					<Button onclick={handleNewTemplate}>new +</Button>
				</div>
			</div>

			<!-- Editor -->
			<div class="flex w-full flex-col gap-4 rounded border border-foreground/20 p-4 md:w-2/3">
				{#if active_id}
					{@const tpl = templates[active_id]}
					<div class="flex flex-wrap items-center justify-between gap-2">
						<Input type="text" value={tpl.title} oninput={(e) => handleUpdateTitle(active_id, e)} />
						<div class="flex gap-2">
							<Button intent="secondary" size="sm" onclick={() => handleDuplicate(active_id)}
								>Duplicate</Button
							>
							<Button intent="destructive" size="sm" onclick={() => handleDelete(active_id)}
								>Delete</Button
							>
						</div>
					</div>
					<ActiveTemplate
						template={configState.root.get('templates').get(active_id) as TemplateStruct}
					/>
				{:else}
					<div
						class="flex h-full items-center justify-center rounded border-2 border-dashed border-foreground/20 p-8 text-muted-foreground"
					>
						Select a template to edit or create a new one.
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<p>Loading templates...</p>
	{/if}
</section>
