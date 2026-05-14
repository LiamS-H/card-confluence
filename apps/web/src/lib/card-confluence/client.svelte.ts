import { browser, dev } from '$app/environment';
import LocalQueryWorker from '$lib/card-confluence/local-worker?worker';
import type {
	DBStatus,
	LocalWorkerStatus,
	QueryWorkerRequest,
	QueryWorkerResponse
} from '$lib/card-confluence/local-worker';
import {
	QueryEventsChannel,
	QueryReqChannel,
	QueryResChannel
} from '$lib/card-confluence/channels';
import { SvelteMap } from 'svelte/reactivity';
import { cache_get, cache_clear, type CacheKey } from './cache';
import { tableFromIPC } from '@uwdata/flechette';
import type { Card, Print, CompletionOption, Completion } from '@card-confluence/wasm-browser';

export interface QueryResultRow {
	oracle_id: string;
	matched_prints: string[];
}

export interface QueryResult {
	rows: QueryResultRow[];
}

export interface QueryRequest {
	query: string;
}

type ClientResponse<T> =
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
			result: T;
	  };

export type QueryResponse = ClientResponse<QueryResult>;

export type DetailedCard = Card & {
	prints: Print[];
};
export type CardResponse = ClientResponse<DetailedCard>;
export type RulingsResponse = ClientResponse<{
	oracle_id: string;
}>;

export function query_to_string(query: QueryRequest): string {
	return query.query;
}

class QueryClient {
	private epoch = $state(0);
	db_status = $state<DBStatus>('loading');
	ready = false;
	private initialized = false;

	// key is the idb key, value is the js memory result value
	private queries_data_map: Map<CacheKey, QueryResult> = new Map();
	// key is the query as a string, value is the idx_db key
	public queries: SvelteMap<string, QueryResponse> = new SvelteMap();

	// map consumer_tag (a unique tag representing who is in line) to a card id
	//   we use a queue because it is performant to batch these requests,
	//   we use a consumer_tag because consumers might change their mind before a batch comes, and this way we purge the old value.
	private cards_queue: Map<string, string> = new Map();
	// when batch is processed this stores the id currently awaiting response (so that they can be retried)
	private cards_batch_timeout: NodeJS.Timeout | null = null;

	public cards: SvelteMap<string, CardResponse> = new SvelteMap();
	public rulings: SvelteMap<string, CardResponse> = new SvelteMap();

	// a unique id given to the request in flight
	private in_flight: Map<string, QueryWorkerRequest> = new Map();

	private on_self_promotion: LockGrantedCallback<unknown> = async (lock) => {
		// when called with ifAvailable, this will exit early and mark the client ready because there is already a leader
		if (!lock) {
			console.log('[cc-client] connected as follower.');
			this.ready = true;
			return false;
		}
		console.log('[cc-client] connected as leader.');
		if (dev) {
			console.warn('[cc-client] cache cleared. cache is cleared aggressively in dev.');
			await cache_clear();
		}

		// TODO: this is where we can check for internet connection, and which worker to use
		// This also locks the main db files, meaning we can't sync them from opfs, currently we kill and restart wasm to get new files
		const dbWorker = new LocalQueryWorker();

		dbWorker.onmessage = (e: MessageEvent<LocalWorkerStatus>) => {
			if (e.data === 'ready') {
				// tell others there is a new leader
				QueryEventsChannel.postMessage({ type: 'promotion' });
				this.on_promotion();
			}
		};

		this.ready = true;

		// empty promise to resolve when leader is released
		return new Promise(() => {});
	};

	private async on_worker_response(event: MessageEvent<QueryWorkerResponse>) {
		const response = event.data;
		const req_id = response.req_id;
		const request = this.in_flight.get(req_id);
		if (!request) {
			// this request did not come from this tab
			return;
		}
		this.in_flight.delete(req_id);

		switch (request.type) {
			case 'query': {
				const query_str = query_to_string(request.query);
				const query = this.queries.get(query_str);
				if (!query) {
					console.error(
						'[cc-client] A query was responded to without being in the queries Map.\
                        All queries should get an entry in the map went first requested'
					);
					return;
				}
				if (response.type === 'error') {
					this.queries.set(query_str, {
						loading: false,
						error: true,
						message: response.message
					});
					return;
				}
				if (response.type === 'completion') {
					throw new Error('completion returned for non completion request.');
				}

				if (query.loading !== true) {
					return;
				}

				const { index } = response;
				const stored_data = this.queries_data_map.get(index);
				if (stored_data) {
					this.queries.set(req_id, {
						loading: false,
						error: false,
						result: stored_data
					});
					return;
				}

				const data = await cache_get(index);
				if (!data) {
					const message = '[cc-client] db index returned by worker has no associated data.';
					console.error(message);
					this.queries.set(req_id, {
						loading: false,
						error: true,
						message
					});
					return;
				}
				const table = tableFromIPC(data);
				const rows = table.toArray() as QueryResultRow[];
				this.queries.set(req_id, {
					loading: false,
					error: false,
					result: {
						rows
					}
				});
				return;
			}
			case 'cards': {
				if (response.type === 'error') {
					for (const id of request.ids) {
						this.cards.set(id, { error: true, loading: false, message: response.message });
					}
					return;
				}
				if (response.type === 'completion') {
					throw new Error('completion returned for non completion request.');
				}

				const data = await cache_get(response.index);
				if (!data) {
					const message = '[cc-client] db index returned by worker has no associated data.';
					for (const id of request.ids) {
						this.cards.set(id, { error: true, loading: false, message });
					}
					return;
				}
				const table = tableFromIPC(data);
				// const rows = table.toArray() as QueryResultRow[];

				for (let i = 0; i < table.numRows; i++) {
					const card = table.at(i) as DetailedCard;
					this.cards.set(card.oracle_id, { loading: false, error: false, result: card });
				}
				return;
			}
			// case 'sets':
			// case 'rulings':
		}
	}

	private on_promotion() {
		if (this.in_flight.size > 0) {
			console.log(
				`[cc-client] resending ${this.in_flight.size} inflight requests.`,
				this.in_flight
			);
		}
		for (const request of this.in_flight.values()) {
			QueryReqChannel.postMessage(request);
		}
	}

	private process_cards_batch() {
		if (this.cards_batch_timeout) clearTimeout(this.cards_batch_timeout);
		this.cards_batch_timeout = null;

		if (this.cards_queue.size === 0) return;

		const ids = [...new Set(this.cards_queue.values())];
		this.cards_queue.clear();

		const req_id = crypto.randomUUID();
		const req = { req_id, type: 'cards', ids } as const;
		this.in_flight.set(req_id, req);
		QueryReqChannel.postMessage(req);
	}

	private request_card_batch() {
		if (this.cards_batch_timeout) return;
		this.cards_batch_timeout = setTimeout(() => this.process_cards_batch(), 200);
	}

	public ensure_card(card_id: string, tag: string): void {
		if (this.cards.has(card_id)) return;
		this.cards_queue.set(tag, card_id);
		this.request_card_batch();
	}

	public ensure_query(query: QueryRequest): void {
		const key = query_to_string(query);
		if (this.queries.has(key)) return;

		this.queries.set(key, { loading: true, error: false });

		const req_id = key;
		const req = { req_id, type: 'query', query } as const;
		this.in_flight.set(req_id, req);
		QueryReqChannel.postMessage(req);
	}

	public async autocomplete(query: QueryRequest, pos: number): Promise<Completion> {
		const controller = new AbortController();
		const req_id = crypto.randomUUID();

		const request: QueryWorkerRequest = {
			req_id,
			type: 'completion',
			pos,
			query
		};

		QueryReqChannel.postMessage(request);

		const { promise, resolve, reject } = Promise.withResolvers<Completion>();

		QueryResChannel.onmessage(async (e) => {
			if (e.data.req_id !== req_id) return;
			controller.abort();
			if (e.data.type === 'error' || e.data.type === 'result') {
				reject();
				return;
			}
			const completion = e.data.completion;
			if (e.data.index === null) {
				return resolve(completion);
			}
			const data = await cache_get(e.data.index);
			if (!data) {
				const message = '[cc-client] db index returned by worker has no associated data.';
				console.error(message);
				this.queries.set(req_id, {
					loading: false,
					error: true,
					message
				});
				return;
			}
			const options = tableFromIPC(data).toArray() as CompletionOption[];

			resolve({ ...completion, options });

			// const rows = table.toArray() as QueryResultRow[];
		}, controller);

		return promise;
	}

	public async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		// register the resolver
		QueryResChannel.onmessage((e) => this.on_worker_response(e));

		QueryEventsChannel.onmessage((event) => {
			switch (event.data.type) {
				case 'db-status':
					this.db_status = event.data.status;
					if (event.data.status === 'synced') {
						this.on_promotion();
					}
					return;
				case 'db-sync':
					this.db_status = 'loading';
					this.clear_cache();
					return;
			}
		});

		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);
		// <--- this code is only reached when not the leader. --->
		this.on_promotion();
		// listen for other promotions.
		QueryEventsChannel.onmessage((event) => {
			switch (event.data.type) {
				case 'promotion':
					this.on_promotion();
					return;
			}
		});

		// promote when lock is free later
		navigator.locks.request('db-leader-lock', {}, this.on_self_promotion);
		return;
	}

	private invalidate_all() {
		this.epoch += 1;
	}

	public track_invalidations() {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		this.epoch;
	}

	private clear_cache() {
		this.queries.clear();
		this.queries_data_map.clear();
		this.cards.clear();
		this.invalidate_all();
	}

	public update_db_latest() {
		QueryEventsChannel.postMessage({ type: 'db-sync' });
		this.clear_cache();
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
