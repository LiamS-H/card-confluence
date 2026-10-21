import { use_query, type QueryResultRow, query_client, type DetailedCard } from '$lib';

import { type Tag, type VirtualTag } from 'codemirror-lang-veldt-deck';
import { SvelteMap } from 'svelte/reactivity';
import { uuid_to_string, type UUIDString, string_to_uuid } from '$lib/utils/uuid';
import type { OracleCardSerialized } from '@repo/schema-sync';

export interface ViewTag {
	tag: Tag | VirtualTag;
	matches(card: OracleCardSerialized | string): boolean;
	destroy?(): void;
}

export class TagQuery implements ViewTag {
	tag: Tag = $state() as Tag;

	data!: ReturnType<typeof use_query>;
	private cleanupRoot: () => void;

	matchedIds: Map<UUIDString, QueryResultRow['matched_prints']> = $derived.by(() => {
		if (!this.data || this.data.response.loading || this.data.response.error) {
			return new SvelteMap();
		}
		return new SvelteMap(
			this.data.response.result.rows.map((r) => [uuid_to_string(r.oracle_id), r.matched_prints])
		);
	});

	constructor(tag: Tag, eager: boolean) {
		this.tag = tag;
		let first_time = true;

		this.cleanupRoot = $effect.root(() => {
			this.data = use_query(() => ({ query: this.tag.query }), 500, `${tag.scope}:${tag.label}`);
			if (first_time && eager) {
				this.data.query_now({ query: this.tag.query });
			}
			first_time = false;
		});
	}

	matches(card: OracleCardSerialized | string): boolean {
		const id = typeof card === 'string' ? card : card.oracle_id;
		return this.matchedIds.has(id as UUIDString);
	}

	destroy() {
		this.cleanupRoot();
	}
}

export class TagManual implements ViewTag {
	tag: VirtualTag;
	protected cleanupRoot?: () => void;

	constructor({ label }: { label: string }) {
		this.tag = {
			object: 'virtual-tag',
			label,
			scope: null
		};
	}

	matches(card: OracleCardSerialized | string): boolean {
		const id_str = typeof card === 'string' ? card : card.oracle_id;
		const packed = string_to_uuid(id_str);
		if (!packed) return false;

		query_client.track_invalidations();
		const response = query_client.get_card(packed);

		if (!response || response.loading || response.error) {
			query_client.ensure_card(packed, id_str);
			return false;
		}

		return this.check_card(response.result, card);
	}

	check_card(card: DetailedCard, raw: OracleCardSerialized | string): boolean {
		card;
		raw;
		return false;
	}

	destroy() {
		this.cleanupRoot?.();
	}
}

export type TagPredicate = (card: DetailedCard, raw: OracleCardSerialized | string) => boolean;

export class TagManualPredicate extends TagManual {
	private predicate: TagPredicate;

	constructor(tag: { label: string }, predicate: TagPredicate) {
		super(tag);
		this.predicate = predicate;
	}

	override check_card(card: DetailedCard, raw: OracleCardSerialized | string): boolean {
		return this.predicate(card, raw);
	}
}
