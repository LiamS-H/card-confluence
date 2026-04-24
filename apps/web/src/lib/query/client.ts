import { browser, dev } from '$app/environment';
import LocalQueryWorker from '$lib/query/local-worker?worker';
import type { LocalWorkerStatus, QueryWorkerResponse } from '$lib/query/local-worker';
import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '$lib/query/channels';
import { SvelteMap } from 'svelte/reactivity';
import { cache_get, cache_clear, local_cache, QUERY_CACHE_TABLE } from './cache';
import { tableFromIPC } from '@uwdata/flechette';
import type { Card } from 'wasm-browser';

export interface QueryRequest {
	query: string;
}

export type QueryResponse =
	| {
			loading: true;
			error: false;
	  }
	| {
			loading: false;
			error: true;
			message: string;
	  }
	| {
			loading: false;
			error: false;
			ids: string[];
	  };

export type CardResponse =
	| {
			loading: true;
			error: false;
	  }
	| {
			loading: false;
			error: true;
			message: string;
	  }
	| {
			loading: false;
			error: false;
			card: Card;
	  };

export function query_to_string(query: QueryRequest): string {
	return query.query;
}

// Stable string key from a Uint8Array, used as a Map key for IDB index bytes.
// Uint8Array instances are compared by reference not value, so they can't be used directly as Map keys.
function index_to_key(index: Uint8Array<ArrayBuffer>): string {
	return index.join(',');
}

const CHUNK_SIZE = 10;

class QueryClient {
	ready = false;
	private isLeader = false;
	private initialized = false;

	private query_timeout: NodeJS.Timeout | null = null;
	// the key is the unique queue id for a given caller, the value is [query_tag, ready_at, debounce_ms]
	private query_queue: Map<string, [string, number, number]> = new Map();
	// the key is the query_tag
	private query_map: Map<string, QueryRequest> = new Map();
	// maps stable string key of idb index bytes -> list of oracle_ids
	private response_cache: Map<string, string[]> = new Map();
	// key is the query_tag, value is the stable string key of idb index bytes
	private response_index_map: Map<string, string> = new Map();
	// the raw idb index bytes, keyed by their stable string key
	private response_index_bytes: Map<string, Uint8Array<ArrayBuffer>> = new Map();
	public responses: SvelteMap<string, QueryResponse> = new SvelteMap();

	private chunk_timeout: NodeJS.Timeout | null = null;
	// key is slot_key — one entry per caller, so a rapidly scrolling virtualized list overwrites its
	// own entry rather than accumulating stale chunks. value is [tag, chunk, ready_at, debounce_ms]
	private chunk_queue: Map<string, [string, number, number, number]> = new Map();
	// tracks which "tag:chunk" regions have already been fetched
	private fetched_chunks: Set<string> = new Set();
	// key is the oracle_id, value is [tag_ref, row_index] — tag_ref is a shared object per query result
	// so all cards from the same query point to the same reference
	private cards_index: Map<string, [{ tag: string }, number]> = new Map();
	public cards: SvelteMap<string, CardResponse> = new SvelteMap();

	private on_self_promotion: LockGrantedCallback<unknown> = (lock) => {
		// when called with ifAvailable, this will exit early and mark the client ready because there is already a leader
		if (!lock) {
			console.log('I am not the leader');
			this.ready = true;
			this.process_query_queue();
			return false;
		}
		// TODO: this is where we can check for internet connection, and which worker to use
		// This also locks the main db files, meaning we can't sync them from opfs, currently we kill and restart wasm to get new files
		const dbWorker = new LocalQueryWorker();

		dbWorker.onmessage = (e: MessageEvent<LocalWorkerStatus>) => {
			if (e.data === 'ready') {
				this.process_query_queue();
				// tell others there is a new leader
				QueryEventsChannel.postMessage({ type: 'promotion' });
			}
		};

		this.isLeader = true;
		this.ready = true;

		// empty promise returned only when released
		return new Promise(() => {});
	};

	private on_other_promotion() {
		for (const tag of this.responses.keys()) {
			const query = this.query_map.get(tag);
			if (!query) {
				this.responses.set(tag, {
					loading: false,
					error: true,
					message: 'Unable to locate query'
				});
				continue;
			}

			this.responses.set(tag, {
				loading: true,
				error: false
			});
			// ensure each unique query gets a unique key
			this.query_queue.set(tag, [tag, 0, 0]);
		}
		this.process_query_queue();
	}

	public async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		if (dev) {
			await cache_clear();
		}
		// register the resolver
		QueryResChannel.onmessage(async (event: MessageEvent<QueryWorkerResponse>) => {
			const tag = event.data.tag;
			const response = this.responses.get(tag);
			if (event.data.type === 'error') {
				this.responses.set(tag, {
					loading: false,
					error: true,
					message: event.data.error
				});
				return;
			}

			if (!response) {
				return;
			}

			if (response.loading !== true) {
				return;
			}

			const index = event.data.index;
			const index_key = index_to_key(index);
			const stored_data = this.response_cache.get(index_key);
			if (stored_data) {
				this.responses.set(tag, {
					loading: false,
					error: false,
					ids: stored_data
				});
				return;
			}

			let time = Date.now();
			const data = await cache_get(index);
			if (!data) {
				this.responses.set(tag, {
					loading: false,
					error: true,
					message: 'db index returned by worker has no associated data.'
				});
				return;
			}
			console.log('indexdb cache read', Date.now() - time);
			time = Date.now();
			const table = tableFromIPC(data);
			console.log('table', Date.now() - time);
			time = Date.now();

			const ids = table.getChild('oracle_id').toArray() as string[];
			console.log('ids', Date.now() - time);
			time = Date.now();

			this.response_cache.set(index_key, ids);
			this.response_index_map.set(tag, index_key);
			this.response_index_bytes.set(index_key, index);

			this.responses.set(tag, {
				loading: false,
				error: false,
				ids: ids
			});

			// this takes 10x anything else
			const tag_ref = { tag };
			for (let i = 0; i < table.numRows; i++) {
				const id = ids[i] as string;
				if (this.cards_index.has(id)) {
					continue;
				}
				this.cards_index.set(id, [tag_ref, i]);
			}

			console.log('save cards', Date.now() - time);
		});

		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);
		// <--- this code is only reached when not the leader. --->

		// listen for other promotions.
		QueryEventsChannel.onmessage((event) => {
			switch (event.data.type) {
				case 'promotion':
					this.on_other_promotion();
					return;
				case 'db-sync-complete':
					this.on_other_promotion();
					return;
				case 'db-sync':
					return;
			}
		});

		// promote when lock is free later
		navigator.locks.request('db-leader-lock', {}, this.on_self_promotion);
		return;
	}

	public update_db_latest() {
		QueryEventsChannel.postMessage({ type: 'db-sync' });
		if (!this.isLeader) {
			return;
		}
		this.on_other_promotion();
		this.responses.clear();
	}

	private process_query(query: QueryRequest) {
		QueryReqChannel.postMessage(query);
	}

	private process_query_queue() {
		if (!this.ready) {
			return;
		}
		if (this.query_queue.size === 0) {
			return;
		}
		for (const [q_id, [tag, ready_at, debounce]] of this.query_queue) {
			if (Date.now() - ready_at < debounce) {
				continue;
			}
			const query = this.query_map.get(tag) as QueryRequest;
			this.process_query(query);
			this.query_queue.delete(q_id);
		}
		if (this.query_timeout) {
			clearTimeout(this.query_timeout);
		}
		this.query_timeout = setTimeout(() => this.process_query_queue(), 100);
	}

	// public refetch(query: QueryRequest) {
	// 	const key = query_to_string(query);

	// 	this.responses.set(key, { loading: true, error: false });
	// 	this.queue.push(query);
	// 	this.process_queue();
	// }

	public ensure_query(query: QueryRequest, queue_key: string, debounce = 300) {
		const tag = query_to_string(query);

		if (this.responses.has(tag)) return;

		this.query_queue.set(queue_key, [tag, Date.now(), debounce]);
		this.query_map.set(tag, query);
		this.responses.set(tag, { loading: true, error: false });

		this.process_query_queue();
	}

	public query(query: QueryRequest, queue_key: string, debounce = 0): QueryResponse {
		const tag = query_to_string(query);
		const stored = this.responses.get(tag);
		if (stored) {
			return stored;
		}

		this.query_queue.set(queue_key, [tag, Date.now(), debounce]);
		this.query_map.set(tag, query);
		this.responses.set(tag, { error: false, loading: true });

		// for testing: could be removed, and queue could be polled every so often
		this.process_query_queue();
		return this.responses.get(tag) as QueryResponse;
	}

	private async process_chunk_queue() {
		if (this.chunk_queue.size === 0) {
			return;
		}

		// maps query tag to set of chunk indices to fetch in this pass
		const to_fetch: Map<string, Set<number>> = new Map();
		const now = Date.now();
		for (const [slot_key, [tag, chunk, ready_at, debounce]] of this.chunk_queue) {
			if (now - ready_at < debounce) {
				continue;
			}
			this.chunk_queue.delete(slot_key);

			// enqueue the target chunk and its neighbors for look-ahead buffering,
			// skipping any that have already been fetched
			const neighbors = chunk > 0 ? [chunk - 1, chunk, chunk + 1] : [chunk, chunk + 1];
			for (const c of neighbors) {
				const chunk_key = `${tag}:${c}`;
				if (this.fetched_chunks.has(chunk_key)) continue;
				// mark as fetched before the async result arrives so concurrent
				// calls don't redundantly enqueue the same chunks
				this.fetched_chunks.add(chunk_key);
				to_fetch.getOrInsert(tag, new Set()).add(c);
			}
		}

		if (this.chunk_timeout) {
			clearTimeout(this.chunk_timeout);
		}
		this.chunk_timeout = setTimeout(() => this.process_chunk_queue(), 100);

		if (to_fetch.size === 0) {
			return;
		}

		const db = await local_cache;
		const tx = db.transaction(QUERY_CACHE_TABLE, 'readonly');
		const store = tx.objectStore(QUERY_CACHE_TABLE);

		for (const [tag, chunks] of to_fetch) {
			const index_key = this.response_index_map.get(tag);
			if (!index_key) {
				console.error('Card index map and response index map out of sync');
				continue;
			}
			const idb_idx = this.response_index_bytes.get(index_key)!;
			const request = store.get(idb_idx);
			const sorted_chunks = Int32Array.from(chunks).sort();

			request.onsuccess = () => {
				const table = tableFromIPC(request.result);
				for (const chunk of sorted_chunks) {
					const min = Math.max(chunk * CHUNK_SIZE, 0);
					const max = Math.min(min + CHUNK_SIZE, table.numRows);
					for (let i = min; i < max; i++) {
						const card = table.at(i) as Card;
						this.cards.set(card.oracle_id, { loading: false, error: false, card });
					}
				}
			};
			request.onerror = () => {};
		}
		tx.commit();
	}

	public ensure_card(id: string, slot_key: string, debounce = 100) {
		// card not yet indexed — index is built when the query resolves, nothing to do yet
		const index = this.cards_index.get(id);
		if (!index) return;

		const [{ tag }, idx] = index;
		const chunk = (idx / CHUNK_SIZE) | 0;

		if (!this.cards.has(id)) {
			this.cards.set(id, { loading: true, error: false });
		}

		// overwrite any previous entry for this slot — the caller's latest position wins
		this.chunk_queue.set(slot_key, [tag, chunk, Date.now(), debounce]);
		this.process_chunk_queue();
	}
}

declare global {
	interface Window {
		__query_client?: QueryClient;
	}
}

function get_or_create_client(): QueryClient {
	if (!browser) {
		return new QueryClient();
	}
	if (typeof window === 'undefined') {
		return new QueryClient();
	}

	if (!window.__query_client) {
		const client = new QueryClient();
		window.__query_client = client;
		client.init();
	}

	return window.__query_client;
}

export const query_client = get_or_create_client();
