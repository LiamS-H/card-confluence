/// <reference lib="webworker" />

import init, { CardConfluenceBrowser } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	handle_query_request,
	setWorkerStatus,
	worker_status,
	type QueryWorkerMessage
} from './shared';
import { get_opfs_metadata } from '../db-meta';

async function initBrowser(): Promise<CardConfluenceBrowser> {
	setWorkerStatus({ state: 'loading', data: 'local' });
	await init();

	const [metadata, error] = await get_opfs_metadata();
	console.log('[worker] found local data', metadata, error);
	if (error) {
		const message = `OPFS error, unable to read metadata.json ${error}`;
		QueryEventsChannel.postMessage({
			type: 'db-status',
			status: { state: 'error', data: 'local', message }
		});
		throw Error(message);
	}
	setWorkerStatus({ state: 'processing', data: 'local' });

	const browser = await CardConfluenceBrowser.new_opfs(metadata);

	setWorkerStatus({ state: 'ready', data: 'local', metadata });

	return browser;
}

let local_browser = initBrowser();
QueryReqChannel.onmessage(async (event) => {
	const browser = await local_browser;
	const resp = await handle_query_request(browser, event.data);
	QueryResChannel.postMessage(resp);
});

QueryEventsChannel.onmessage((event) => {
	if (event.data.type === 'db-check') {
		QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
	}
});

onmessage = async (event) => {
	const message: QueryWorkerMessage = event.data;
	if (message.action === 'destroy') {
		try {
			const browser = await local_browser;
			browser.free();
		} catch {}
		postMessage(undefined);
	}
};
