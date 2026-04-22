import LocalQueryWorker from '$lib/query/local-worker?worker';
import type { QueryRequest, QueryResponse } from '$lib/query/local-worker';
import { createDeferred, type Deferred } from '$lib/utils/deferred';
import { ClientEventsChannel, QueryReqChannel, QueryResChannel } from '$lib/query/channels';
// import { writable, type Writable } from 'svelte/store';

export type ClientEvent = {
	type: 'promotion' | 'db-sync';
};

class QueryClient {
	ready = false;
	leader: null | { worker: Worker } = null;

	queue: QueryRequest[] = [];
	cache: Map<
		string,
		{
			query: QueryRequest;
			deferred: Deferred<QueryResponse>;
		}
	> = new Map();
	queries: Map<string, string> = new Map();

	private on_self_promotion: LockGrantedCallback<unknown> = (lock) => {
		// when called with ifAvailable, this will exit early and mark the client ready because there is already a leader
		if (!lock) {
			this.ready = true;
			this.process_queue();
			return false;
		}

		// TODO: this is where we can check for internet connection, and which worker to use
		// This also locks the main db files, meaning we can't sync them from opfs, currently will kill and restart to get new files
		const dbWorker = new LocalQueryWorker();

		QueryReqChannel.onmessage((message) => {
			const data: QueryRequest = message.data;
			dbWorker.postMessage(data);
		});

		dbWorker.onmessage = (event: MessageEvent<QueryResponse>) => {
			const id = event.data.id;
			const cache = this.cache.get(id);
			if (!cache) {
				return QueryResChannel.postMessage(event.data);
			}
			cache.deferred.resolve(event.data);
		};

		// tell others there is a new leader
		ClientEventsChannel.postMessage({ type: 'promotion' });

		this.leader = { worker: dbWorker };
		this.ready = true;
		this.process_queue();

		// empty promise returned only when released
		return new Promise(() => {});
	};

	private on_other_promotion() {
		for (const cache of this.cache.values()) {
			this.queue.push(cache.query);
			cache.deferred = createDeferred();
		}
		this.process_queue();
	}

	private process_query(query: QueryRequest) {
		if (this.leader === null) {
			QueryReqChannel.postMessage(query);
			return;
		}

		this.leader.worker.postMessage(query);
	}

	private process_queue() {
		if (!this.ready) return;
		for (const query of this.queue) {
			this.process_query(query);
		}
		this.queue = [];
	}

	public async init(): Promise<void> {
		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);
		// <--- this code is only reached when not the leader. --->

		// listen for other promotions.
		ClientEventsChannel.onmessage((event) => {
			switch (event.data.type) {
				case 'promotion':
					this.on_other_promotion();
					return;
			}
		});

		// promote when lock is free later
		navigator.locks.request('db-leader-lock', {}, this.on_self_promotion);
		return;
	}

	public fetch_latest() {
		ClientEventsChannel.postMessage({ type: 'db-sync' });
		if (!this.leader) {
			return;
		}
		this.on_other_promotion();
		this.cache = new Map();
	}

	public async query(request: Omit<QueryRequest, 'id'>): Promise<QueryResponse> {
		const cached_id = this.queries.get(request.query);
		if (cached_id) {
			const cache = this.cache.get(cached_id);
			if (cache) {
				return cache.deferred.promise;
			} else {
				this.queries.delete(cached_id);
			}
		}
		const id = crypto.randomUUID();

		const query = { ...request, id };
		this.queue.push(query);
		const deferred = createDeferred<QueryResponse>();
		this.cache.set(id, { deferred: deferred, query });
		// for testing: could be removed, and queue could be pulled every so often
		this.process_queue();
		return deferred.promise;
	}
}

export const query_client = new QueryClient();
if (typeof window !== 'undefined') {
	query_client.init();
}
