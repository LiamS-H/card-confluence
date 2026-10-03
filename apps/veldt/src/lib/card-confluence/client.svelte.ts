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
	Completion
} from '@card-confluence/wasm-browser';
import { get_local_settings, type LocalSettings } from '$lib/settings';
import { uuid_key, type UUIDKey } from '$lib/utils/uuid';
import { compare_metadata, get_opfs_metadata, get_remote_metadata } from './db-meta';
import { PUBLIC_PARQUET_LATEST } from '$env/static/public';
import { QueryResultArrayBufferView } from './query-result';
import type { RelativeIndexable } from '$lib/utils/array';

export type { Print };

export interface QueryResultRow {
	oracle_id: Card['oracle_id'];
	/** A packed array of matching prints */
	matched_prints: Uint8Array<ArrayBufferLike>;
}

export interface QueryResult {
	rows: RelativeIndexable<QueryResultRow>;
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

	// map consumer_tag (a unique tag representing who is in line) to the key of the card it wants
	//   we use a queue because it is performant to batch these requests,
	//   we use a consumer_tag because consumers might change their mind before a batch comes, and this way we purge the old value.
	private cards_queue: Map<string, UUIDKey> = new Map();
	// card key -> the card's packed uuid plus how many consumer_tags currently want it.
	//   this is what dedupes the batch: consumers wanting the same card share one entry,
	//   and the entry only goes away once every consumer that wanted it has changed its mind.
	private card_refs: Map<UUIDKey, { uuid: Card['oracle_id']; count: number }> = new Map();
	private cards_batch_timeout: NodeJS.Timeout | null = null;

	// keyed by uuid_key(oracle_id), not the raw bytes: Maps (and svelte reactivity) compare typed arrays by reference.
	//   use get_card() to look up by packed uuid.
	public cards: SvelteMap<UUIDKey, CardResponse> = new SvelteMap();

	// maps <a unique id given to the request in flight, to a request>
	private in_flight: Map<string, QueryWorkerRequest> = new Map();

	private on_self_promotion: LockGrantedCallback<unknown> = async (lock) => {
		if (!lock) {
			console.log('[cc-client] connected as follower.');
			return false;
		}
		console.log('[cc-client] connected as leader.');
		if (dev) {
			console.warn('[cc-client] cache cleared. cache is cleared aggressively in dev.');
			await cache_clear();
		}

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
				console.warn('[cc-client] unable to check for remote updates.', remote_error);
				return;
			}
			if (local_error) {
				return;
			}

			const compare = compare_metadata(local_meta, remote_meta);
			if (compare.sources.length === 0) {
				console.log('[cc-client] local db is up to date.');
				return;
			}

			if (settings.database.askEachDownload) {
				// TODO: prompt the user if they wish to download the latest data
			}

			console.log('[cc-client] update available:', compare.sources.length, 'source(s).');
			worker.postMessage({ action: 'download', sources: compare.sources } as QueryWorkerMessage);
		}

		async function handle_settings(settings: LocalSettings) {
			console.log();
			const use_local = settings.database.useLocal !== false;

			if (use_local !== last_use_local) {
				last_use_local = use_local;
				worker.postMessage({
					action: 'set-mode',
					mode: use_local ? 'local' : 'http'
				} as QueryWorkerMessage);
			}

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
				const view = new QueryResultArrayBufferView(data);

				this.queries.set(req_id, {
					loading: false,
					error: false,
					result: {
						rows: view
					}
				});
				return;
			}
			case 'cards': {
				if (response.type === 'error') {
					for (let i = 0; i < request.ids.length; i += 16) {
						const key = uuid_key(request.ids.subarray(i, i + 16));
						this.cards.set(key, {
							error: true,
							loading: false,
							message: response.message
						});
					}
					return;
				}
				if (response.type === 'completion') {
					throw Error('completion returned for non completion request.');
				}

				const data = await cache_get(response.index);
				if (!data) {
					const message = '[cc-client] db index returned by worker has no associated data.';
					for (let i = 0; i < request.ids.length; i += 16) {
						const key = uuid_key(request.ids.subarray(i, i + 16));
						this.cards.set(key, { error: true, loading: false, message });
					}
					return;
				}
				const table = tableFromIPC(data);
				// console.log('[cc-client] ipc size', data.length, 'B');
				// let json_size = 0;
				// for (let i = 0; i < table.numRows; i++) {
				// 	const card = table.at(i) as DetailedCard;
				// 	const json = JSON.stringify(card);
				// 	json_size += json.length;
				// }
				// console.log('[cc-client] json size', json_size, 'B');

				for (let i = 0; i < table.numRows; i++) {
					const card = table.at(i) as DetailedCard;
					this.cards.set(uuid_key(card.oracle_id), {
						loading: false,
						error: false,
						result: card
					});
				}
				return;
			}
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

	/** point a consumer_tag at a card, dropping whatever it previously wanted. */
	private set_card(tag: string, key: UUIDKey, uuid: Card['oracle_id']) {
		const prev = this.cards_queue.get(tag);
		if (prev === key) return; // consumer re-asked for the same card, nothing to do
		if (prev !== undefined) this.remove_card(tag);

		this.cards_queue.set(tag, key);
		const ref = this.card_refs.get(key);
		if (ref) ref.count++;
		else this.card_refs.set(key, { uuid, count: 1 });
	}

	/** drop a consumer_tag's pending request, releasing the card if nobody else wants it. */
	private remove_card(tag: string) {
		const key = this.cards_queue.get(tag);
		if (key === undefined) return;
		this.cards_queue.delete(tag);

		const ref = this.card_refs.get(key)!;
		if (--ref.count === 0) this.card_refs.delete(key);
		console.log('[client]', this.card_refs);
	}

	private process_cards_batch() {
		if (this.cards_batch_timeout) clearTimeout(this.cards_batch_timeout);
		this.cards_batch_timeout = null;

		const size = this.card_refs.size;
		if (size === 0) return;
		console.log('[client] requesting', size, 'cards');

		const ids = new Uint8Array(size * 16);
		let i = 0;
		for (const { uuid } of this.card_refs.values()) {
			ids.set(uuid, i * 16);
			i++;
		}
		this.cards_queue.clear();
		this.card_refs.clear();

		const req_id = crypto.randomUUID();
		const req = { req_id, type: 'cards', ids } as const;
		this.in_flight.set(req_id, req);
		QueryReqChannel.postMessage(req);
	}

	private request_card_batch() {
		if (this.cards_batch_timeout) return;
		this.cards_batch_timeout = setTimeout(() => this.process_cards_batch(), 50);
	}

	/** look up a card response by its packed uuid. reactive per card. */
	public get_card(card_id: Card['oracle_id']): CardResponse | undefined {
		return this.cards.get(uuid_key(card_id));
	}

	public ensure_card(card_id: Card['oracle_id'], tag: string): void {
		const key = uuid_key(card_id);
		if (this.cards.has(key)) {
			// the consumer no longer needs whatever it queued before
			this.remove_card(tag);
			return;
		}
		this.set_card(tag, key, card_id);
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
