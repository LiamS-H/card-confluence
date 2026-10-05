// TODO: Rename this file, and restructure. shared comes from when there were two different worker files
import {
	CardConfluenceBrowser,
	type Completion,
	type MetaData,
	type MetaDataSource
} from '@card-confluence/wasm-browser';
import { QueryEventsChannel } from '../channels';
import {
	cache_store_get,
	cache_store_insert,
	local_cache,
	QUERY_CACHE_TABLE,
	type CacheKey
} from '../cache';
import { type QueryRequest } from '../client.svelte';

export type DBStatus =
	| {
			state: 'loading';
			data: 'local' | 'remote';
	  }
	| {
			state: 'processing';
			data: 'local';
	  }
	| {
			state: 'connecting';
			data: 'remote';
	  }
	| {
			state: 'downloading';
			data: 'remote';
			downloaded: number;
			total: number;
	  }
	| {
			state: 'ready';
			data: 'remote' | 'local';
			metadata: MetaData;
	  }
	| {
			state: 'error';
			data: 'remote' | 'local';
			message: string;
	  };

export const worker_status: DBStatus = { state: 'loading', data: 'remote' };

export function setWorkerStatus(new_status: DBStatus) {
	Object.assign(worker_status, new_status);
	QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
}

export type QueryWorkerEvent =
	| {
			// used by client to get a db status message
			type: 'db-check';
	  }
	| {
			type: 'db-status';
			status: DBStatus;
	  }
	| {
			type: 'error-fatal';
			message: string;
	  }
	| {
			type: 'download-complete';
			success: boolean;
			error?: { type: string; message?: string };
	  };

export type QueryWorkerResponse =
	| {
			req_id: string;
			type: 'error';
			message: string;
	  }
	| {
			req_id: string;
			type: 'result';
			index: CacheKey;
	  }
	| {
			req_id: string;
			type: 'completion';
			index: CacheKey | null;
			completion: Completion;
	  };

export type QueryWorkerRequest =
	| {
			req_id: string;
			type: 'query';
			query: QueryRequest;
	  }
	| {
			req_id: string;
			type: 'cards';
			ids: Uint8Array<ArrayBuffer>;
	  }
	| {
			req_id: string;
			type: 'completion';
			query: QueryRequest;
			pos: number;
	  };

export type QueryWorkerMessage =
	| { action: 'destroy' }
	| { action: 'set-mode'; mode: 'http' | 'local' | 'local_mem' }
	| { action: 'download'; sources: MetaDataSource[] };

export async function handle_query_request(
	browser: CardConfluenceBrowser,
	request: QueryWorkerRequest
): Promise<QueryWorkerResponse> {
	console.log('[worker] handling request', request);
	let timer = Date.now();
	function timed_print(text: string) {
		const now = Date.now();
		const dif = now - timer;
		if (dif !== 0) {
			console.log(`[worker] ${request.req_id.substring(0, 4)} ${dif}`, text);
		} else {
			console.log(`[worker] ${request.req_id.substring(0, 4)} ${text}`);
		}
		timer = now;
	}
	let message!: QueryWorkerResponse;
	try {
		const cache = await local_cache;
		let key!: Uint8Array<ArrayBuffer>;
		let plan!: Uint8Array<ArrayBuffer>;
		switch (request.type) {
			case 'query': {
				timed_print('starting plan build');
				const hashedPlan = await browser.query_plan_from_query(request.query.query);
				timed_print('plan finished');
				key = hashedPlan.hash as unknown as Uint8Array<ArrayBuffer>;
				plan = hashedPlan.plan as unknown as Uint8Array<ArrayBuffer>;
				break;
			}
			case 'cards': {
				const hashedPlan = await browser.cards_plan_from_card_ids(request.ids);
				key = hashedPlan.hash as unknown as Uint8Array<ArrayBuffer>;
				plan = hashedPlan.plan as unknown as Uint8Array<ArrayBuffer>;
				break;
			}
			case 'completion': {
				const evaluation = await browser.completion_plan_from_query(
					request.query.query,
					request.pos
				);
				plan = evaluation.plan as unknown as Uint8Array<ArrayBuffer>;
				key = plan;
				const completion = evaluation.completion;
				message = {
					req_id: request.req_id,
					type: 'completion',
					completion,
					index: key
				};
				if (plan.length == 0) {
					message.index = null;
					return message;
				}
				break;
			}
		}

		const readTx = cache.transaction([QUERY_CACHE_TABLE], 'readonly');
		const readStore = readTx.objectStore(QUERY_CACHE_TABLE);
		// console.log('[worker] getting cache');
		timed_print('checking cached');
		let data = await cache_store_get(key, readStore);

		if (data === null) {
			timed_print('cache miss');
			timed_print('evaluating plan');

			// In local db, these awaits never suspend and we only need one transaction,
			// for the http store, the js event loop empties and we have to make a second transaction.
			if (request.type === 'query') {
				data = (await browser.evaluate_query_plan(plan)) as Uint8Array<ArrayBuffer>;
			} else {
				data = (await browser.evaluate_plan(plan)) as Uint8Array<ArrayBuffer>;
			}
			timed_print(`plan evaluated, inserting data ${data.length}B`);

			const writeTx = cache.transaction([QUERY_CACHE_TABLE], 'readwrite');
			const writeStore = writeTx.objectStore(QUERY_CACHE_TABLE);
			await cache_store_insert(key, data, writeStore);
			timed_print('data inserted');
		}
		timed_print('cache hit');
		message ??= {
			req_id: request.req_id,
			type: 'result',
			index: key
		};
	} catch (error) {
		timed_print('encountered error');
		console.error(String(error));
		message = {
			req_id: request.req_id,
			type: 'error',
			message: String(error)
		};
	}

	return message;
}
