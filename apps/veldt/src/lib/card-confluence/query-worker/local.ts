/// <reference lib="webworker" />

import init, { CardConfluenceBrowser } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import { handle_query_request, setWorkerStatus, worker_status, type DBStatus } from './shared';
import { get_opfs_metadata } from '../db-meta';

async function initBrowser(): Promise<CardConfluenceBrowser> {
	setWorkerStatus({ state: 'loading' });
	await init();

	const [metadata, error] = await get_opfs_metadata();
	console.log('[worker] found local data', metadata);
	if (error) {
		const message = `OPFS error, unable to read metadata.json ${error}`;
		QueryEventsChannel.postMessage({ type: 'error-fatal', message });
		throw Error(message);
	}
	setWorkerStatus({ state: 'processing', data: 'local' });
	const browser = await CardConfluenceBrowser.new_opfs(metadata);

	setWorkerStatus({ state: 'ready', data: 'local', metadata });

	return browser;
}

let http_browser = initBrowser();
QueryReqChannel.onmessage(async (event) => {
	const browser = await http_browser;
	const resp = await handle_query_request(browser, event.data);
	QueryResChannel.postMessage(resp);
});

QueryEventsChannel.onmessage((event) => {
	if (event.data.type === 'db-check') {
		QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
	}
});
