/// <reference lib="webworker" />
import init, { CardConfluenceLocal } from 'wasm-browser';
import { get_local_parquet, sync_local_parquet } from './files';
import { ClientEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import { cache_get, cache_insert, local_cache } from './cache';

export interface QueryRequest {
	id: string;
	query: string;
}

export type QueryResponse =
	| {
			id: string;
			type: 'error';
			error: unknown;
	  }
	| {
			id: string;
			type: 'result';
			data: unknown;
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
	const browser = await local_browser;
	let message!: QueryResponse;
	const cache = await local_cache;
	try {
		// remove shared array buffer during cast
		const plan = (await browser.plan_index(event.data.query)) as Uint8Array<ArrayBuffer>;

		const transaction = cache.transaction(['queries'], 'readwrite');
		const store = transaction.objectStore('queries');
		let data = await cache_get(plan, store);
		if (data === null) {
			data = (await browser.query(plan)) as Uint8Array<ArrayBuffer>;
			await cache_insert(plan, data, store);
		}
		message = {
			id: event.data.id,
			type: 'result',
			data: plan
		};
	} catch (error) {
		message = {
			id: event.data.id,
			type: 'error',
			error
		};
	}

	QueryResChannel.postMessage(message);
}

self.onmessage = handle_message;

QueryReqChannel.onmessage(handle_message);

ClientEventsChannel.onmessage(async (event) => {
	if (event.data.type === 'db-sync') {
		const browser = await local_browser;
		browser.free();

		local_browser = initBrowser(sync_local_parquet());
	}
});
