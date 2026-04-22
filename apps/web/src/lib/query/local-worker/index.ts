/// <reference lib="webworker" />
import init, { CardConfluenceLocal } from 'wasm-browser';
import { get_local_parquet, sync_local_parquet } from './files';
import { ClientEventsChannel } from '../channels';

export interface QueryRequest {
	id: string;
	query: string;
}

export type QueryResponse =
	| {
			id: string;
			type: 'error';
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

self.onmessage = async (event: MessageEvent<QueryRequest>) => {
	const browser = await local_browser;
	let message!: QueryResponse;
	try {
		const result = await browser.query(event.data.query);
		message = {
			id: event.data.id,
			type: 'result',
			data: result
		};
	} catch {
		message = {
			id: event.data.id,
			type: 'error'
		};
	}

	self.postMessage(message);
};

ClientEventsChannel.onmessage(async (event) => {
	if (event.data.type === 'db-sync') {
		const browser = await local_browser;
		browser.free();

		local_browser = initBrowser(sync_local_parquet());
	}
});
