import type { Group, Tag, View, VirtualTag } from 'codemirror-lang-veldt-deck';
import type { OracleCardSerialized } from '@repo/schema-sync';
import type { UUIDString } from '$lib/utils/uuid';
import type { TagQuery, ViewTag } from '$lib/editor/tags.svelte';
import type { VirtualView } from '$lib/editor/view.svelte';
import type { TagDocState } from '$lib/editor/tag-doc.svelte';

// ---------------------------------------------------------------------------
// Normalized item shapes — what the unified view component works with
// ---------------------------------------------------------------------------

export type NormalizedTag = {
	type: 'tag';
	id: string;
	tag: Tag;
	viewTag: TagQuery;
} | {
	type: 'virtual-tag';
	id: string;
	tag: VirtualTag;
	viewTag: ViewTag;
};

export interface NormalizedGroup {
	type: 'group';
	id: string;
	group: Group;
	tags: NormalizedTag[];
}

export type NormalizedItem = NormalizedTag | NormalizedGroup;

export interface NormalizedView {
	label: string;
	settings: {
		showUnmatched: boolean;
		showEmpty: boolean;
	};
	items: NormalizedItem[];
}

// ---------------------------------------------------------------------------
// Normalizer: VirtualView → NormalizedView
// ---------------------------------------------------------------------------

export function normalize_virtual_view(view: VirtualView): NormalizedView {
	const items: NormalizedTag[] = view.tags.map((viewTag, i) => ({
		type: 'virtual-tag',
		id: `virtual-${i}-${viewTag.tag.label}`,
		tag: viewTag.tag as VirtualTag,
		viewTag
	}));

	return {
		label: view.label,
		settings: view.settings,
		items
	};
}

// ---------------------------------------------------------------------------
// Normalizer: Doc View → NormalizedView  (fixes the childKey/key bug)
// ---------------------------------------------------------------------------

export function normalize_doc_view(
	view: View,
	view_tags: Map<string, TagQuery>,
	tag_doc: TagDocState
): NormalizedView {
	const objects = tag_doc.parsed.objects;
	const visited = new Set<string>();

	function normalize_tag(tag: Tag, id: string): NormalizedTag | null {
		const viewTag = view_tags.get(id);
		if (!viewTag) return null;
		return { type: 'tag', id, tag, viewTag };
	}

	function normalize_group(group: Group, id: string): NormalizedGroup {
		const tags: NormalizedTag[] = [];

		for (const childKey of group.children) {
			if (visited.has(childKey)) continue;
			visited.add(childKey);

			// BUG FIX: was `objects.get(key)` (the group key) — must be childKey
			const child = objects.get(childKey);
			if (!child) continue;
			if (child.object === 'view') continue;

			if (child.object === 'tag') {
				const normalized = normalize_tag(child, childKey);
				if (normalized) tags.push(normalized);
				continue;
			}

			if (child.object === 'group') {
				// Flatten nested groups into synthetic virtual-tag aggregates
				const { cards: _c, queries } = collect_group(child, view_tags, objects);
				tags.push({
					type: 'tag',
					id: childKey,
					tag: {
						object: 'tag',
						label: child.label,
						scope: child.scope,
						query: '(' + [...queries].join(') or (') + ')'
					},
					viewTag: view_tags.get(childKey) as TagQuery
				});
			}
		}

		return { type: 'group', id, group, tags };
	}

	const items: NormalizedItem[] = [];

	for (const key of view.children) {
		if (visited.has(key)) continue;
		visited.add(key);

		const obj = objects.get(key);
		if (!obj) continue;
		if (obj.object === 'view') continue;

		if (obj.object === 'tag') {
			const normalized = normalize_tag(obj, key);
			if (normalized) items.push(normalized);
		} else if (obj.object === 'group') {
			items.push(normalize_group(obj, key));
		}
	}

	return {
		label: view.label ?? '',
		settings: view.settings,
		items
	};
}

// ---------------------------------------------------------------------------
// Helper: recursively collect cards + queries from a nested group
// ---------------------------------------------------------------------------

function collect_group(
	group: Group,
	view_tags: Map<string, TagQuery>,
	objects: Map<string, ReturnType<TagDocState['parsed']['objects']['get']> & {}>
): { cards: Set<OracleCardSerialized>; queries: Set<string> } {
	const cards: Set<OracleCardSerialized> = new Set();
	const queries: Set<string> = new Set();

	for (const key of group.children) {
		const obj = objects.get(key);
		if (!obj) continue;

		if (obj.object === 'tag') {
			const viewTag = view_tags.get(key);
			if (!viewTag) continue;
			if (obj.query) queries.add(obj.query);
		} else if (obj.object === 'group') {
			const nested = collect_group(obj, view_tags, objects);
			nested.queries.forEach((q) => queries.add(q));
		}
	}

	return { cards, queries };
}

// ---------------------------------------------------------------------------
// Runtime card resolution — used by view-tag.svelte
// Called inside a reactive context ($derived.by) so it tracks reactivity.
// ---------------------------------------------------------------------------

export function resolve_tag_cards(
	viewTag: ViewTag,
	all_cards: OracleCardSerialized[],
	included_oracle_ids: Set<string>
): { cards: OracleCardSerialized[]; loading: boolean } {
	const tq = viewTag as TagQuery;
	const loading = !!(tq.data?.response?.loading);

	if (loading) {
		return { cards: [], loading: true };
	}

	const cards = all_cards.filter((c) => {
		const matched = viewTag.matches(c);
		if (matched) included_oracle_ids.add(c.oracle_id as UUIDString);
		return matched;
	});

	return { cards, loading: false };
}
