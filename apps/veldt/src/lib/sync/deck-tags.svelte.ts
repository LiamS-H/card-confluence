import { use_query, type QueryResultRow } from '$lib';

import { type Tag } from 'codemirror-lang-veldt-deck';
import { SvelteMap } from 'svelte/reactivity';
import { uuid_to_string, type UUIDString } from '$lib/utils/uuid';

export class TagQuery {
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

	destroy() {
		this.cleanupRoot();
	}
}
