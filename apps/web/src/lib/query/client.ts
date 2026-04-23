import { browser } from '$app/environment';
import LocalQueryWorker from '$lib/query/local-worker?worker';
import type { LocalWorkerStatus, QueryWorkerResponse } from '$lib/query/local-worker';
import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '$lib/query/channels';
import { SvelteMap } from 'svelte/reactivity';
// import { writable, type Writable } from 'svelte/store';

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
			data: Uint8Array<ArrayBuffer>;
			message: string;
	  };

export function query_to_string(query: QueryRequest): string {
	return query.query;
}

class QueryClient {
	ready = false;
	private leader: null | { worker: Worker } = null;
	private initialized = false;

	private queue: QueryRequest[] = [];
	private queries: Map<string, QueryRequest> = new Map();
	public responses: SvelteMap<string, QueryResponse> = new SvelteMap();

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
		// This also locks the main db files, meaning we can't sync them from opfs, currently will kill and restart to get new files
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
			this.queue.push(query);
		}
		this.process_queue();
	}

	public async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		// register the promise resolver
		QueryResChannel.onmessage((event: MessageEvent<QueryWorkerResponse>) => {
			const tag = event.data.tag;
			const response = this.responses.get(tag);
			if (!response) {
				return;
			}
			if (response.loading !== true) {
				return;
			}

			let message!: QueryResponse;
			if (event.data.type === 'error') {
				message = {
					loading: false,
					error: true,
					message: event.data.error
				};
			} else {
				message = {
					loading: false,
					error: false,
					data: event.data.data,
					message: ''
				};
			}
			console.log('[client]', tag, message);
			this.responses.set(tag, message);
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
		for (const query of this.queue) {
			this.process_query(query);
		}
		this.queue = [];
	}

	public refetch(query: QueryRequest) {
		const key = query_to_string(query);

		this.responses.set(key, { loading: true, error: false });
		this.queue.push(query);
		this.process_queue();
	}

	public ensure(query: QueryRequest, flush = true) {
		const key = query_to_string(query);

		if (this.responses.has(key)) return;

		this.queries.set(key, query);
		this.responses.set(key, { loading: true, error: false });
		this.queue.push(query);

		if (flush) this.process_queue();
	}

	public query(query: QueryRequest, flush = true): QueryResponse {
		const key = query_to_string(query);
		const stored = this.responses.get(key);
		if (stored) {
			return stored;
		}

		this.queries.set(key, query);
		this.queue.push(query);
		this.responses.set(key, { error: false, loading: true });

		// for testing: could be removed, and queue could be polled every so often
		if (flush) {
			this.process_queue();
		}
		return this.responses.get(key) as QueryResponse;
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
