import { browser, dev } from '$app/environment';
import LocalQueryWorker from '$lib/query/local-worker?worker';
import type { LocalWorkerStatus, QueryWorkerResponse } from '$lib/query/local-worker';
import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '$lib/query/channels';
import { SvelteMap } from 'svelte/reactivity';
import { cache_get, cache_clear } from './cache';
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

class QueryClient {
	ready = false;
	private leader: null | { worker: Worker } = null;
	private initialized = false;

	private queue: Map<string, QueryRequest> = new Map();
	private queries: Map<string, QueryRequest> = new Map();
	private response_cache: Map<Uint8Array<ArrayBuffer>, string[]> = new Map();
	public responses: SvelteMap<string, QueryResponse> = new SvelteMap();
	public cards: SvelteMap<string, Card> = new SvelteMap();

	// private retry_timeout: NodeJS.Timeout | null = null;

	private on_self_promotion: LockGrantedCallback<unknown> = (lock) => {
		// when called with ifAvailable, this will exit early and mark the client ready because there is already a leader
		if (!lock) {
			console.log('I am not the leader');
			this.ready = true;
			this.process_queue();
			return false;
		}
		// TODO: this is where we can check for internet connection, and which worker to use
		// This also locks the main db files, meaning we can't sync them from opfs, currently we kill and restart wasm to get new files
		const dbWorker = new LocalQueryWorker();

		dbWorker.onmessage = (e: MessageEvent<LocalWorkerStatus>) => {
			if (e.data === 'ready') {
				this.process_queue();
				// tell others there is a new leader
				QueryEventsChannel.postMessage({ type: 'promotion' });
			}
		};

		this.leader = { worker: dbWorker };
		this.ready = true;

		// empty promise returned only when released
		return new Promise(() => {});
	};

	private on_other_promotion() {
		for (const key of this.responses.keys()) {
			const query = this.queries.get(key);
			if (!query) {
				this.responses.set(key, {
					loading: false,
					error: true,
					message: 'Unable to locate query'
				});
				continue;
			}

			this.responses.set(key, {
				loading: true,
				error: false
			});
			this.queue.set(key, query);
		}
		this.process_queue();
	}

	public async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		if (dev) {
			await cache_clear();
		}
		// register the resolver
		QueryResChannel.onmessage(async (event: MessageEvent<QueryWorkerResponse>) => {
			let time = Date.now();
			const tag = event.data.tag;
			const response = this.responses.get(tag);
			if (!response) {
				return;
			}
			if (response.loading !== true) {
				return;
			}

			if (event.data.type === 'error') {
				this.responses.set(tag, {
					loading: false,
					error: true,
					message: event.data.error
				});
				return;
			}

			const index = event.data.index;
			const stored_data = this.response_cache.get(index);
			if (stored_data) {
				this.responses.set(tag, {
					loading: false,
					error: false,
					ids: stored_data
				});
			}

			console.log('begin_idb', Date.now() - time);
			time = Date.now();
			const data = await cache_get(index);
			if (!data) {
				this.responses.set(tag, {
					loading: false,
					error: true,
					message: 'db index returned by worker has no associated data.'
				});
				return;
			}
			console.log('idb_took', Date.now() - time);
			time = Date.now();
			const table = tableFromIPC(data);
			console.log('table_took', Date.now() - time);
			time = Date.now();

			const ids = table.getChild('oracle_id').toArray() as string[];
			console.log('ids_took', Date.now() - time);
			time = Date.now();

			this.response_cache.set(index, ids);

			this.responses.set(tag, {
				loading: false,
				error: false,
				ids: ids
			});

			// this take 10x anything else
			for (let i = 0; i < table.numRows; i++) {
				const id = ids[i] as string;
				if (this.cards.has(id)) continue;
				const card = table.get(i) as Card;
				this.cards.set(card.oracle_id, card);
			}

			console.log('cards_took', Date.now() - time);
			// const array = table.toArray();
			// for (const card of array) {
			// 	const id = card['oracle_id'];
			// }
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
		if (!this.leader) {
			return;
		}
		this.on_other_promotion();
		this.responses.clear();
	}

	private process_query(query: QueryRequest) {
		if (this.leader !== null) {
			this.leader.worker.postMessage(query);
			return;
		}

		QueryReqChannel.postMessage(query);
	}

	private process_queue() {
		if (!this.ready) {
			return;
		}
		// this.retry_timeout = null;
		for (const query of this.queue.values()) {
			this.process_query(query);
		}
		this.queue.clear();
	}

	// public refetch(query: QueryRequest) {
	// 	const key = query_to_string(query);

	// 	this.responses.set(key, { loading: true, error: false });
	// 	this.queue.push(query);
	// 	this.process_queue();
	// }

	public ensure_query(query: QueryRequest, tag: string, flush = true) {
		const key = query_to_string(query);

		if (this.responses.has(key)) return;

		this.queries.set(key, query);
		this.responses.set(key, { loading: true, error: false });
		this.queue.set(tag, query);

		if (flush) this.process_queue();
	}

	public query(query: QueryRequest, tag: string, flush = true): QueryResponse {
		const key = query_to_string(query);
		const stored = this.responses.get(key);
		if (stored) {
			return stored;
		}

		this.queries.set(key, query);
		this.responses.set(key, { error: false, loading: true });
		this.queue.set(tag, query);

		// for testing: could be removed, and queue could be polled every so often
		if (flush) {
			this.process_queue();
		}
		return this.responses.get(key) as QueryResponse;
	}

	// public ensure_card(id: string) {
	// 	if (this.cards.has(id)) return;

	// 	this.cards.set(id, { loading: true, error: false });
	// }
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
