<script lang="ts">
	import type { DeckZone, OracleCardSerialized } from '@repo/schema-sync';
	import type { View, Tag, Group } from 'codemirror-lang-veldt-deck';
	import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
	import { use_settings } from '$lib/settings';
	import type { UUIDString } from '$lib/utils/uuid';
	import ViewTag from './view-tag.svelte';

	const {
		cards,
		view,
		width,
		zone
	}: { cards: OracleCardSerialized[]; view: View; width: number; zone: DeckZone } = $props();

	const deck = use_deck_cards();

	export type DisplayTag =
		| {
				type: 'tag';
				id: string;
				tag: Tag;
				cards: OracleCardSerialized[];
		  }
		| {
				// A virtual tag does not apear in the tag document
				type: 'virtual-tag';
				tag: {
					object: 'virtual-tag';
					label: string;
					scope: null;
				};
				cards: OracleCardSerialized[];
		  };

	interface DisplayGroup {
		type: 'group';
		id: string;
		group: Group;
		tags: DisplayTag[];
		total: number;
	}
	const display_items = $derived.by(() => {
		const included_cards = new Set();

		function tag_to_display(obj: Tag, key: string): DisplayTag {
			const fetched = deck.tags_fetched.get(key);
			if (!fetched) {
				return {
					type: 'tag',
					id: key,
					tag: obj,
					cards: []
				};
			}
			const filtered = cards.filter((c) => {
				const out = fetched.matchedIds.has(c.oracle_id as UUIDString);
				if (out) {
					included_cards.add(c.oracle_id);
				}
				return out;
			});
			return {
				type: 'tag',
				id: key,
				tag: obj,
				cards: filtered
			};
		}

		if (!view) return [];

		const out: (DisplayTag | DisplayGroup)[] = [];
		const visited = new Set();

		function recurse_group(group: Group, cards: Set<OracleCardSerialized>, queries: Set<string>) {
			for (const key of group.children) {
				if (visited.has(key)) continue;
				const obj = deck.doc_state.parsed.objects.get(key);
				if (!obj) continue;
				if (obj.object === 'view') continue;
				if (obj.object === 'tag') {
					const fetched = deck.tags_fetched.get(key);
					if (!fetched) continue;

					const total = cards.size;
					cards.forEach((c) => {
						if (fetched.matchedIds.has(c.oracle_id as UUIDString)) {
							cards.add(c);
						}
					});
					if (total !== cards.size) {
						queries.add(obj.query);
					}
				}
				if (obj.object === 'group') {
					recurse_group(obj, cards, queries);
				}
			}
			return { cards, queries };
		}

		function group_to_display(group: Group, key: string): DisplayGroup {
			const tags: DisplayTag[] = [];
			let total = 0;
			for (const key of group.children) {
				if (visited.has(key)) continue;
				const obj = deck.doc_state.parsed.objects.get(key);
				if (!obj) continue;
				if (obj.object === 'view') continue;
				if (obj.object === 'tag') {
					const tag = tag_to_display(obj, key);
					total += tag.cards.length;
					tags.push(tag);
					continue;
				}
				const matching_cards: Set<OracleCardSerialized> = new Set();
				const queries: Set<string> = new Set();
				recurse_group(group, matching_cards, queries);
				total += matching_cards.size;
				included_cards.union(matching_cards);

				tags.push({
					type: 'tag',
					id: key,
					tag: {
						object: 'tag',
						label: obj.label,
						scope: obj.scope,
						query: '(' + [...queries].join(') or (') + ')'
					},
					cards: Array.from(matching_cards)
				});
			}

			return {
				total,
				type: 'group',
				id: key,
				group,
				tags
			};
		}

		for (const key of view.children) {
			visited.add(key);
			const obj = deck.doc_state.parsed.objects.get(key);
			if (!obj) continue;
			if (obj.object === 'tag') {
				out.push(tag_to_display(obj, key));
			} else if (obj.object === 'group') {
				out.push(group_to_display(obj, key));
			}
		}

		if (view.settings.showUnmatched) {
			const filtered = cards.filter((c) => !included_cards.has(c.oracle_id as UUIDString));
			out.push({
				type: 'virtual-tag',
				tag: { object: 'virtual-tag', label: 'unmatched', scope: null },
				cards: filtered
			});
		}

		if (!view.settings.showEmpty) {
			return out.filter((obj) => {
				if (obj.type === 'group') {
					if (obj.total === 0) return false;
					obj.tags = obj.tags.filter((t) => t.cards.length !== 0);
					return true;
				} else if (obj.cards.length !== 0) {
					return true;
				} else {
					return false;
				}
			});
		}
		return out;
	});

	const {
		cards: { deckVariant: variant }
	} = $derived(use_settings());
</script>

<div
	style={variant !== 'img-full' ? `columns: ${width}px` : undefined}
	class={variant === 'img-full' ? 'flex max-w-full flex-wrap' : ''}
>
	{#each display_items as item}
		<div class="relative flex break-inside-avoid flex-col overflow-y-hidden bg-background">
			{#if item.type === 'tag'}
				<ViewTag tag={item} {variant} {width} {zone} />
			{:else if item.type === 'group'}
				<span>{item.group.label}</span>
				<div class="flex flex-col"></div>
				{#each item.tags as tag}
					<ViewTag {tag} {variant} {width} {zone} />
				{/each}
			{:else}
				<ViewTag
					tag={{
						id: '',
						// using invalid scope to not match against tags actually called unmatched
						tag: { label: 'unmatched', object: 'tag', query: '', scope: ':unmatched' },
						type: 'tag',
						cards: item.cards
					}}
					{variant}
					{width}
					{zone}
				/>
			{/if}
		</div>
	{/each}
</div>
