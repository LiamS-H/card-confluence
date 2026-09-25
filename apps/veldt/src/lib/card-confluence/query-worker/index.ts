/// <reference lib="webworker" />

import init, { CardConfluenceBrowser, type MetaData } from '@card-confluence/wasm-browser';
import DownloadWorker from '$lib/card-confluence/download-worker?worker';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	handle_query_request,
	setWorkerStatus,
	worker_status,
	type QueryWorkerMessage
} from './shared';
import { get_remote_metadata, get_opfs_metadata } from '../db-meta';

const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

console.log('[worker] initialising wasm');
const wasm_ready = init();
console.log('[worker] wasm initialized');

let active_browser: CardConfluenceBrowser | null = null;
let http_browser: CardConfluenceBrowser | null = null;
let local_browser: CardConfluenceBrowser | null = null;
let current_mode: 'http' | 'local' | null = null;

let http_metadata: MetaData | null = null;
let local_metadata: MetaData | null = null;

async function ensure_http(): Promise<boolean> {
	if (http_browser) return true;

	setWorkerStatus({ state: 'connecting', data: 'remote' });
	const [metadata, error] = await get_remote_metadata(PUBLIC_PARQUET_LATEST);
	if (error) {
		const message = `Http error, unable to read metadata.json ${JSON.stringify(error)}`;
		setWorkerStatus({ state: 'error', data: 'remote', message });
		return false;
	}
	http_metadata = metadata;
	http_browser = await CardConfluenceBrowser.new_http(PUBLIC_PARQUET_LATEST, metadata);
	return true;
}

async function ensure_local(): Promise<boolean> {
	if (local_browser) return true;

	setWorkerStatus({ state: 'processing', data: 'local' });
	const [metadata, error] = await get_opfs_metadata();
	if (error) {
		const message = `OPFS error, unable to read metadata.json ${error}`;
		setWorkerStatus({ state: 'error', data: 'local', message });
		return false;
	}
	local_metadata = metadata;
	local_browser = await CardConfluenceBrowser.new_opfs(metadata);
	return true;
}

function free_local() {
	if (local_browser) {
		local_browser.free();
		local_browser = null;
		local_metadata = null;
	}
}

function free_http() {
	if (http_browser) {
		http_browser.free();
		http_browser = null;
		http_metadata = null;
	}
}

async function set_mode(mode: 'http' | 'local') {
	await wasm_ready;

	if (mode === current_mode) return;

	if (mode === 'http') {
		setWorkerStatus({ state: 'loading', data: 'remote' });
		const ok = await ensure_http();
		if (!ok) return;
		active_browser = http_browser;
		current_mode = 'http';
		setWorkerStatus({ state: 'ready', data: 'remote', metadata: http_metadata! });
		// Free local browser to release OPFS locks when not needed
		free_local();
	} else {
		setWorkerStatus({ state: 'loading', data: 'local' });
		const ok = await ensure_local();
		if (!ok) return;
		active_browser = local_browser;
		current_mode = 'local';
		setWorkerStatus({ state: 'ready', data: 'local', metadata: local_metadata! });
		// Free http browser when using local
		free_http();
	}
}

async function handle_download(sources: import('@card-confluence/wasm-browser').MetaDataSource[]) {
	await wasm_ready;

	// Free local browser to release OPFS read locks before downloading
	free_local();

	// Ensure HTTP is active for queries during download
	if (current_mode !== 'http') {
		const ok = await ensure_http();
		if (ok) {
			active_browser = http_browser;
			current_mode = 'http';
			setWorkerStatus({ state: 'ready', data: 'remote', metadata: http_metadata! });
		}
	}

	QueryEventsChannel.postMessage({
		type: 'download-progress',
		downloaded: 0,
		total: sources.length
	});

	// Spawn download sub-worker
	const worker = new DownloadWorker();

	const { promise, resolve } = Promise.withResolvers<void>();

	worker.onmessage = async (event: MessageEvent) => {
		const data = event.data;
		if (data.status === 'progress') {
			QueryEventsChannel.postMessage({
				type: 'download-progress',
				downloaded: data.downloaded,
				total: data.total
			});
			return;
		}

		// Terminal states: success or error
		worker.terminate();

		if (data.status === 'success') {
			QueryEventsChannel.postMessage({ type: 'download-complete', success: true });
			// Switch to local after successful download
			await set_mode('local');
		} else {
			QueryEventsChannel.postMessage({
				type: 'download-complete',
				success: false,
				error: data.message || data.type || 'Unknown download error'
			});
		}

		resolve();
	};

	worker.onerror = (e) => {
		console.error('[unified-worker] download sub-worker error:', e);
		worker.terminate();
		QueryEventsChannel.postMessage({
			type: 'download-complete',
			success: false,
			error: String(e)
		});
		resolve();
	};

	worker.postMessage({ sources });

	return promise;
}

// Queue requests that arrive before a browser is active
const pending_requests: MessageEvent[] = [];
let draining = false;

async function drain_pending() {
	if (draining) return;
	draining = true;
	while (pending_requests.length > 0) {
		const event = pending_requests.shift()!;
		const resp = await handle_query_request(active_browser!, event.data);
		QueryResChannel.postMessage(resp);
	}
	draining = false;
}

// Handle queries using active browser
QueryReqChannel.onmessage(async (event) => {
	await wasm_ready;
	if (!active_browser) {
		pending_requests.push(event);
		return;
	}
	const resp = await handle_query_request(active_browser, event.data);
	QueryResChannel.postMessage(resp);
});

// Handle db-check events
QueryEventsChannel.onmessage((event) => {
	if (event.data.type === 'db-check') {
		QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
	}
});

// Handle commands from client via postMessage
onmessage = async (event) => {
	const msg: QueryWorkerMessage = event.data;
	switch (msg.action) {
		case 'set-mode': {
			await set_mode(msg.mode);
			// Drain any requests that queued while waiting for a browser
			if (active_browser && pending_requests.length > 0) {
				await drain_pending();
			}
			break;
		}
		case 'download': {
			await handle_download(msg.sources);
			break;
		}
		case 'destroy': {
			free_local();
			free_http();
			active_browser = null;
			current_mode = null;
			postMessage(undefined);
			break;
		}
	}
};
