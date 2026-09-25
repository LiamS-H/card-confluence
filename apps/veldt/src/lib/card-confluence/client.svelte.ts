import { browser, dev } from '$app/environment';
import QueryWorker from '$lib/card-confluence/query-worker?worker';
import type {
	DBStatus,
	QueryWorkerMessage,
	QueryWorkerRequest,
	QueryWorkerResponse
} from '$lib/card-confluence/query-worker/shared';

import {
	QueryEventsChannel,
	QueryReqChannel,
	QueryResChannel
} from '$lib/card-confluence/channels';
import { SvelteMap } from 'svelte/reactivity';
import { cache_get, cache_clear, type CacheKey } from './cache';
import { tableFromIPC } from '@uwdata/flechette';
import type {
	Card,
	Print,
	Set as MTGSet,
	Ruling,
	CompletionOption,
	Completion,
	MetaData
} from '@card-confluence/wasm-browser';
import { get_local_settings, type LocalSettings } from '$lib/settings';
import { compare_metadata, get_opfs_metadata, get_remote_metadata } from './db-meta';
import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

export type { Print };

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
	prints: (Print & { set: MTGSet })[];
	rulings: Ruling[] | null;
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
	db_status = $state<DBStatus>({
		state: 'loading',
		data: get_local_settings().database.useLocal ? 'local' : 'remote'
	});
	private initialized = false;

	// key is the idb key, value is the js memory result value
	private queries_data_map: Map<CacheKey, QueryResult> = new Map();
	// key is the query as a string, value is the idx_db key
	public queries: SvelteMap<string, QueryResponse> = new SvelteMap();

	// map consumer_tag (a unique tag representing who is in line) to a card id
	//   we use a queue because it is performant to batch these requests,
	//   we use a consumer_tag because consumers might change their mind before a batch comes, and this way we purge the old value.
	private cards_queue: Map<string, string> = new Map();
	private cards_batch_timeout: NodeJS.Timeout | null = null;

	public cards: SvelteMap<string, CardResponse> = new SvelteMap();
	public rulings: SvelteMap<string, CardResponse> = new SvelteMap();

	// a unique id given to the request in flight
	private in_flight: Map<string, QueryWorkerRequest> = new Map();

	private on_self_promotion: LockGrantedCallback<unknown> = async (lock) => {
		// when called with ifAvailable, this will exit early and mark the client ready because there is already a leader
		if (!lock) {
			console.log('[cc-client] connected as follower.');
			return false;
		}
		console.log('[cc-client] connected as leader.');
		if (dev) {
			console.warn('[cc-client] cache cleared. cache is cleared aggressively in dev.');
			await cache_clear();
		}

		// Single unified worker, spawned once. Mode switches and downloads are now
		// just postMessage calls into it — no more terminate/recreate cycle.
		const worker = new QueryWorker();
		worker.onerror = (e) => {
			console.error(
				'[cc-client] worker failed to start. can happen when env variables are missing.',
				e
			);
		};

		let last_use_local: boolean | null = null;

		async function check_for_update(settings: LocalSettings) {
			const [remote_meta, remote_error] = await get_remote_metadata(PUBLIC_PARQUET_LATEST);
			const [local_meta, local_error] = await get_opfs_metadata();

			if (remote_error) {
				// Can't reach remote metadata right now — nothing to compare against,
				// stay on whatever mode we're already in.
				console.warn('[cc-client] unable to check for remote updates.', remote_error);
				return;
			}
			if (local_error) {
				// No local db yet. set_mode('local') will have already surfaced an
				// error via worker status if this was supposed to be a local session;
				// nothing more to do here.
				return;
			}

			const compare = compare_metadata(local_meta, remote_meta);
			if (compare.sources.length === 0) {
				console.log('[cc-client] local db is up to date.');
				return;
			}

			// TODO: when settings.database.askEachDownload is true, prompt the user
			// here and only continue if they confirm. For now downloads proceed
			// automatically.
			console.log('[cc-client] update available:', compare.sources.length, 'source(s).');
			worker.postMessage({ action: 'download', sources: compare.sources } as QueryWorkerMessage);
		}

		async function handle_settings(settings: LocalSettings) {
			console.log();
			const use_local = settings.database.useLocal !== false;

			// Eagerly tell the worker which mode to use straight from settings — no
			// metadata fetch on the startup path. The worker resolves whatever
			// metadata it actually needs internally (new_http needs remote meta,
			// new_opfs needs local meta), so queries can start flowing immediately.
			if (use_local !== last_use_local) {
				last_use_local = use_local;
				worker.postMessage({
					action: 'set-mode',
					mode: use_local ? 'local' : 'http'
				} as QueryWorkerMessage);
			}

			// Update-checking is a background concern: it doesn't gate queries,
			// which are already being served by set-mode above. If an update is
			// found, the worker's own download flow (free_local -> ensure_http ->
			// download -> set_mode('local')) takes care of switching over.
			if (use_local) {
				void check_for_update(settings);
			}
		}

		// no memory leak since this is a singleton class attached to the tab.
		$effect.root(() => {
			$effect(() => {
				const settings = $state.snapshot(get_local_settings());
				handle_settings(settings);
			});
		});

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
                        All queries should get an entry in the map when first requested'
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
					throw Error('completion returned for non completion request.');
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
					throw Error('completion returned for non completion request.');
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
		console.log('[client] requesting', this.cards_queue.size, 'cards');

		const ids = [...new Set(this.cards_queue.values())];
		this.cards_queue.clear();

		const req_id = crypto.randomUUID();
		const req = { req_id, type: 'cards', ids } as const;
		this.in_flight.set(req_id, req);
		QueryReqChannel.postMessage(req);
	}

	private request_card_batch() {
		if (this.cards_batch_timeout) return;
		this.cards_batch_timeout = setTimeout(() => this.process_cards_batch(), 50);
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
		}, controller);

		return promise;
	}

	public async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		QueryResChannel.onmessage((e) => this.on_worker_response(e));

		QueryEventsChannel.onmessage((event) => {
			switch (event.data.type) {
				case 'db-status':
					this.db_status = event.data.status;
					if (event.data.status.state === 'ready') {
						this.on_promotion();
					}
					return;
			}
		});

		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);

		QueryEventsChannel.postMessage({ type: 'db-check' });

		// promote when lock is free later
		navigator.locks.request('db-leader-lock', {}, this.on_self_promotion);
		return;
	}

	// private invalidate_all() {
	// 	this.epoch += 1;
	// }

	public track_invalidations() {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		this.epoch;
	}

	// private clear_cache() {
	// 	this.queries.clear();
	// 	this.queries_data_map.clear();
	// 	this.cards.clear();
	// 	this.invalidate_all();
	// }

	// public update_db_latest() {
	// 	QueryEventsChannel.postMessage({ type: 'db-sync' });
	// 	this.clear_cache();
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
