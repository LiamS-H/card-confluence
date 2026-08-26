import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

import init, {
	CardConfluenceBrowser,
	type Completion,
	type CompletionPlan,
	type MetaData
} from '@card-confluence/wasm-browser';
import { QueryEventsChannel, QueryReqChannel } from '../channels';
import {
	cache_clear,
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
			state: 'downloading';
			data: 'local';
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
			state: 'ready';
			data: 'remote' | 'local';
			metadata: MetaData;
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
			// will add more info to db status for the version and type of connection
			// each client will maintain a svelte state object tracking this info
			type: 'db-status';
			status: DBStatus;
	  }
	| {
			type: 'error-fatal';
			message: string;
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
			ids: string[];
	  }
	| {
			req_id: string;
			type: 'completion';
			query: QueryRequest;
			pos: number;
	  }
	| {
			req_id: string;
			type: 'sets';
			ids: string[];
	  }
	| {
			req_id: string;
			type: 'rulings';
			ids: string[];
	  };

export async function handle_query_request(
	browser: CardConfluenceBrowser,
	request: QueryWorkerRequest
): Promise<QueryWorkerResponse> {
	let message!: QueryWorkerResponse;
	try {
		const cache = await local_cache;
		let plan!: Uint8Array<ArrayBuffer>;
		switch (request.type) {
			case 'query': {
				plan = (await browser.query_plan_from_query(
					request.query.query
				)) as Uint8Array<ArrayBuffer>;
				break;
			}
			case 'cards': {
				plan = (await browser.cards_plan_from_card_ids(request.ids)) as Uint8Array<ArrayBuffer>;
				break;
			}
			case 'completion': {
				// console.log('[worker] completion');
				const evaluation = (await browser.completion_plan_from_query(
					request.query.query,
					request.pos
				)) as CompletionPlan;
				plan = evaluation.plan as unknown as Uint8Array<ArrayBuffer>;
				// console.log('[worker] planned', plan);
				const completion = evaluation.completion;
				message = {
					req_id: request.req_id,
					type: 'completion',
					completion,
					index: plan
				};
				if (plan.length == 0) {
					message.index = null;
					return message;
				}
				break;
			}
			// case 'sets':
			// case 'rulings':
		}

		const readTx = cache.transaction([QUERY_CACHE_TABLE], 'readonly');
		const readStore = readTx.objectStore(QUERY_CACHE_TABLE);
		// console.log('[worker] getting cache');
		let data = await cache_store_get(plan, readStore);

		if (data === null) {
			console.log('[worker] cache miss');
			console.log('[worker] evaluating plan');

			// In local db, this await never suspends and we only need one transaction,
			// for the http store, the js event loop empties and we have to make a second transaction.
			data = (await browser.evaluate_plan(plan)) as Uint8Array<ArrayBuffer>;

			console.log('[worker] inserting data');

			const writeTx = cache.transaction([QUERY_CACHE_TABLE], 'readwrite');
			const writeStore = writeTx.objectStore(QUERY_CACHE_TABLE);
			await cache_store_insert(plan, data, writeStore);

			console.log('[worker] data inserted');
		}
		// console.log('[worker] cache hit!');
		message ??= {
			req_id: request.req_id,
			type: 'result',
			index: plan
		};
	} catch (error) {
		message = {
			req_id: request.req_id,
			type: 'error',
			message: String(error)
		};
	}

	return message;
}

QueryEventsChannel.onmessage(async (event) => {
	// This needs a whole overhaul because we need to split the downloading and switching of databases,
	//
	if (event.data.type === 'db-check') {
		QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
	}
	// QueryEventsChannel.postMessage({ type: 'db-status', status: 'downloading' });
	// (await local_browser).free();
	// const intermediate_browser_promise = CardConfluenceBrowser.new_http(PUBLIC_PARQUET_LATEST);

	// const { resolve, reject, promise } = Promise.withResolvers<CardConfluenceBrowser>();
	// local_browser = promise;

	// const reset = cache_clear();

	// const [handles] = await Promise.all([sync_local_parquet(), reset]);
	// // const [handles] = await Promise.all([get_local_parquet(), reset]);
	// if ('type' in handles) {
	// 	const message = `Error ${handles.type}:${handles.message} TODO: Handle gracefully ;)`;
	// 	reject(message);
	// 	QueryEventsChannel.postMessage({ type: 'error-fatal', message: 'failed to get file handle' });
	// 	throw Error(message);
	// }
	// QueryEventsChannel.postMessage({ type: 'db-status', status: 'syncing' });
	// const intermediate_browser = await intermediate_browser_promise;
	// resolve(intermediate_browser);
	// QueryEventsChannel.postMessage({ type: 'db-status', status: 'synced' });
});
