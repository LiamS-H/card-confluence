import type { Print } from '@card-confluence/wasm-browser';
import type { QueryResultRow } from './client.svelte';
import { uuid_key } from '$lib/utils/uuid';
import type { RelativeIndexable } from '$lib/utils/array';

export function match_print(result: QueryResultRow, print_id: Print['scryfall_id']): boolean {
	const match_key = uuid_key(print_id);

	for (let i = 0; i < result.matched_prints.length; i += 16) {
		const key = uuid_key(result.matched_prints.subarray(i, i + 16));
		if (key === match_key) return true;
	}
	return false;
}

export class QueryResultArrayBufferView implements RelativeIndexable<QueryResultRow> {
	private recordCount: number;
	private offsets: Uint32Array<ArrayBufferLike>;
	private oracles: Uint8Array<ArrayBufferLike>;
	private matches: Uint8Array<ArrayBufferLike>;

	get length() {
		return this.recordCount;
	}
	map<R>(callback: (i: QueryResultRow) => R): R[] {
		const out: R[] = [];
		for (let i = 0; i < this.recordCount; i++) {
			out.push(callback(this.at(i)));
		}
		return out;
	}

	at(index: number) {
		const oracle_id = this.oracles.slice(index * 16, (index + 1) * 16);
		const matchStartIndex = this.offsets[index];
		const matchEndIndex = this.offsets[index + 1];

		const matched_prints = this.matches.slice(matchStartIndex * 16, matchEndIndex * 16);

		return { oracle_id, matched_prints };
	}
	print_at(index: number, sub_index: number) {
		const matchStartIndex = this.offsets[index] * 16;
		const matchEndIndex = this.offsets[index + 1];
		if (index > matchEndIndex || index < matchStartIndex) {
			console.error();
		}
		return this.matches.slice(matchStartIndex + sub_index * 16, matchStartIndex);
	}

	constructor(_buffer: Uint8Array<ArrayBuffer>) {
		const buffer = _buffer.buffer;
		this.recordCount = new Uint32Array(buffer, 0, 1)[0];
		this.offsets = new Uint32Array(buffer, 4, this.recordCount + 1);
		this.oracles = new Uint8Array(buffer, 4 + (this.recordCount + 1) * 4, this.recordCount * 16);
		this.matches = new Uint8Array(buffer, this.oracles.byteOffset + this.oracles.byteLength);
	}
}
