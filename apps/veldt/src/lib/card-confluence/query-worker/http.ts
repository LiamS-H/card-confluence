/// <reference lib="webworker" />

import init, { CardConfluenceBrowser } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import { handle_query_request, setWorkerStatus, worker_status, type DBStatus } from './shared';
import { get_remote_metadata } from '../db-meta';
import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

async function initBrowser(): Promise<CardConfluenceBrowser> {
	setWorkerStatus({ state: 'loading', data: 'remote' });
	await init();
	setWorkerStatus({ state: 'connecting', data: 'remote' });
	const [metadata, error] = await get_remote_metadata();
	if (error) {
		const message = `OPFS error, unable to read metadata.json ${error}`;
		QueryEventsChannel.postMessage({ type: 'error-fatal', message });
		throw Error(message);
	}
	const browser = await CardConfluenceBrowser.new_http(PUBLIC_PARQUET_LATEST, metadata);

	setWorkerStatus({ state: 'ready', data: 'remote', metadata: { sources: [] } });

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
