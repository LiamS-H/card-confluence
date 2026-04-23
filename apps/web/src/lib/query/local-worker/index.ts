/// <reference lib="webworker" />
import init, { CardConfluenceLocal } from 'wasm-browser';
import { get_local_parquet, sync_local_parquet } from './files';
import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import { cache_get, cache_insert, local_cache } from './cache';
import { query_to_string, type QueryRequest } from '../client';

export type QueryWorkerEvent = {
	type: 'promotion' | 'db-sync' | 'db-sync-complete' | 'error-fatal';
};

export type QueryWorkerResponse =
	| {
			tag: string;
			type: 'error';
			error: string;
	  }
	| {
			tag: string;
			type: 'result';
			data: Uint8Array<ArrayBuffer>;
	  };

async function initBrowser(files: ReturnType<typeof get_local_parquet>) {
	await init();
	const handles = await files;
	if ('type' in handles) {
		throw Error(`Error ${handles.type}:${handles.message} TODO: Handle gracefully ;)`);
	}

	// const sync_handles = {
	// 	cards: handles.cards.createSyncAccessHandle(),
	// 	sets: handles.sets.createSyncAccessHandle(),
	// 	rulings: handles.rulings.createSyncAccessHandle()
	// };

	const browser = await CardConfluenceLocal.fromFiles(handles);
	return browser;
}

let local_browser = initBrowser(get_local_parquet());

async function handle_message(event: MessageEvent<QueryRequest>) {
	console.log('[worker]', event.data); // why isn't this firing
	let message!: QueryWorkerResponse;
	const tag = query_to_string(event.data);
	try {
		const browser = await local_browser;
		const cache = await local_cache;
		// cast to declare not shared array buffer
		const plan = (await browser.plan_index(event.data.query)) as Uint8Array<ArrayBuffer>;

		const transaction = cache.transaction(['queries'], 'readwrite');
		const store = transaction.objectStore('queries');
		let data = await cache_get(plan, store);
		if (data === null) {
			data = (await browser.query(plan)) as Uint8Array<ArrayBuffer>;
			await cache_insert(plan, data, store);
		}
		message = {
			tag,
			type: 'result',
			data: plan
		};
	} catch (error) {
		message = {
			tag,
			type: 'error',
			error: String(error)
		};
	}

	QueryResChannel.postMessage(message);
}

self.onmessage = handle_message;

QueryReqChannel.onmessage(handle_message);

QueryEventsChannel.onmessage(async (event) => {
	if (event.data.type === 'db-sync') {
		const browser = await local_browser;
		browser.free();

		local_browser = initBrowser(sync_local_parquet());
		await local_browser;
		QueryEventsChannel.postMessage({ type: 'db-sync-complete' });
	}
});

export type LocalWorkerStatus = 'ready';

function updateStatus(status: LocalWorkerStatus) {
	self.postMessage(status);
}

updateStatus('ready');
