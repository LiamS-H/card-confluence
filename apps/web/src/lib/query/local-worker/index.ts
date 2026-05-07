/// <reference lib="webworker" />
import init, { CardConfluenceLocal, type Completion, type CompletionPlan } from 'wasm-browser';
import { get_local_parquet, sync_local_parquet } from './files';
import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	cache_clear,
	cache_store_get,
	cache_store_insert,
	local_cache,
	QUERY_CACHE_TABLE,
	type CacheKey
} from '../cache';
import { type QueryRequest } from '../client.svelte';

export type QueryWorkerEvent = {
	type: 'promotion' | 'db-sync' | 'db-sync-complete' | 'error-fatal';
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

async function initBrowser(
	files: ReturnType<typeof get_local_parquet>
): Promise<CardConfluenceLocal> {
	await init();
	const handles = await files;
	if ('type' in handles) {
		throw Error(`Error ${handles.type}:${handles.message} TODO: Handle gracefully ;)`);
	}

	const browser = new CardConfluenceLocal();

	await browser.attach_files(handles);

	return browser;
}

const local_browser = initBrowser(get_local_parquet());

async function handle_message(event: MessageEvent<QueryWorkerRequest>) {
	const request = event.data;
	let message!: QueryWorkerResponse;
	try {
		const browser = await local_browser;
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
					QueryResChannel.postMessage(message);
					return;
				}
				break;
			}
			// case 'sets':
			// case 'rulings':
		}

		const transaction = cache.transaction([QUERY_CACHE_TABLE], 'readwrite');
		const store = transaction.objectStore(QUERY_CACHE_TABLE);
		// console.log('[worker] getting cache');
		let data = await cache_store_get(plan, store);
		if (data === null) {
			// console.log('[worker] cache miss');
			// console.log('[worker] evaluating plan');
			data = (await browser.evaluate_plan(plan)) as Uint8Array<ArrayBuffer>;
			await cache_store_insert(plan, data, store);
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

	QueryResChannel.postMessage(message);
}

QueryReqChannel.onmessage(handle_message);

QueryEventsChannel.onmessage(async (event) => {
	if (event.data.type === 'db-sync') {
		const browser = await local_browser;
		try {
			browser.release_files();
		} catch {
			// files didn't need to be released
		}

		const reset = cache_clear();
		const [handles] = await Promise.all([sync_local_parquet(), reset]);
		// const [handles] = await Promise.all([get_local_parquet(), reset]);
		if ('type' in handles) {
			throw Error(`Error ${handles.type}:${handles.message} TODO: Handle gracefully ;)`);
		}
		await browser.attach_files(handles);
		QueryEventsChannel.postMessage({ type: 'db-sync-complete' });
	}
});

export type LocalWorkerStatus = 'ready';

function updateStatus(status: LocalWorkerStatus) {
	self.postMessage(status);
}

updateStatus('ready');
