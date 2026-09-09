/// <reference lib="webworker" />

import init, { CardConfluenceBrowser } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	handle_query_request,
	setWorkerStatus,
	worker_status,
	type QueryWorkerMessage
} from './shared';
import { get_remote_metadata } from '../db-meta';
const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

async function initBrowser(): Promise<CardConfluenceBrowser> {
	setWorkerStatus({ state: 'loading', data: 'remote' });
	await init();
	setWorkerStatus({ state: 'connecting', data: 'remote' });
	const [metadata, error] = await get_remote_metadata(PUBLIC_PARQUET_LATEST);
	if (error) {
		const message = `Http error, unable to read metadata.json ${JSON.stringify(error)}`;
		QueryEventsChannel.postMessage({
			type: 'db-status',
			status: { state: 'error', data: 'remote', message }
		});
		throw Error(message);
	}
	const browser = await CardConfluenceBrowser.new_http(PUBLIC_PARQUET_LATEST, metadata);

	setWorkerStatus({ state: 'ready', data: 'remote', metadata });

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

onmessage = async (event) => {
	const message: QueryWorkerMessage = event.data;
	if (message.action === 'destroy') {
		try {
			const browser = await http_browser;
			browser.free();
		} catch {}
		postMessage(undefined);
	}
};
