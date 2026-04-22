import { browser } from '$app/environment';
import LocalQueryWorker from '$lib/query/local-worker?worker';
import type { QueryRequest, QueryResponse } from '$lib/query/local-worker';
import { createDeferred, type Deferred } from '$lib/utils/deferred';
import { ClientEventsChannel, QueryReqChannel, QueryResChannel } from '$lib/query/channels';
// import { writable, type Writable } from 'svelte/store';

export type ClientEvent = {
	type: 'promotion' | 'db-sync' | 'error-fatal';
};

class QueryClient {
	ready = false;
	leader: null | { worker: Worker } = null;

	queue: QueryRequest[] = [];
	responses: Map<
		string,
		{
			query: QueryRequest;
			deferred: Deferred<QueryResponse>;
		}
	> = new Map();

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

		// tell others there is a new leader
		ClientEventsChannel.postMessage({ type: 'promotion' });

		this.leader = { worker: dbWorker };
		this.ready = true;
		this.process_queue();

		// empty promise returned only when released
		return new Promise(() => {});
	};

	private on_other_promotion() {
		for (const response of this.responses.values()) {
			this.queue.push(response.query);
			// reject all queries in transit
			response.deferred.reject();
			response.deferred = createDeferred();
		}
		this.process_queue();
	}

	public async init(): Promise<void> {
		// register the promise resolver
		QueryResChannel.onmessage((event: MessageEvent<QueryResponse>) => {
			const id = event.data.id;
			const response = this.responses.get(id);
			if (!response) {
				return;
			}
			response.deferred.resolve(event.data);
		});

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
				case 'db-sync':
					this.on_other_promotion();
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
		this.responses = new Map();
	}

	private process_query(query: QueryRequest) {
		if (this.leader !== null) {
			this.leader.worker.postMessage(query);
			return;
		}

		QueryReqChannel.postMessage(query);
	}

	private process_queue() {
		if (!this.ready) return;
		for (const query of this.queue) {
			this.process_query(query);
		}
		this.queue = [];
	}

	public async query(request: Omit<QueryRequest, 'id'>): Promise<QueryResponse> {
		const id = crypto.randomUUID();

		const query = { ...request, id };
		this.queue.push(query);
		const deferred = createDeferred<QueryResponse>();
		this.responses.set(id, { deferred: deferred, query });
		// for testing: could be removed, and queue could be polled every so often
		this.process_queue();
		return deferred.promise;
	}
}

export const query_client = new QueryClient();
if (browser) {
	query_client.init();
}
