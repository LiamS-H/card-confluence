/// <reference lib="webworker" />

import init, { CardConfluenceBrowser, type MetaData } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	handle_query_request,
	setWorkerStatus,
	worker_status,
	type QueryWorkerMessage
} from './shared';
import { get_remote_metadata, get_opfs_metadata } from '../db-meta';
import { download_db } from '../download-worker/factory';
import type { DownloadRequest } from '../download-worker';

const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

const wasm_ready = init();

let active_browser: CardConfluenceBrowser | null = null;
let http_browser: CardConfluenceBrowser | null = null;
let local_browser: CardConfluenceBrowser | null = null;
let current_mode: 'http' | 'local' | null = null;

let http_metadata: MetaData | null = null;
let local_metadata: MetaData | null = null;

let worker_task_queue = Promise.resolve();

function enqueue_task<T>(task: () => Promise<T> | T): Promise<T> {
	const next = worker_task_queue.then(task);
	worker_task_queue = next.catch((err) => {
		console.error('[worker] task failed:', err);
	}) as Promise<any>;
	return next;
}

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

async function perform_set_mode(mode: 'http' | 'local') {
	if (mode === current_mode) {
		return;
	}

	if (mode === 'http') {
		setWorkerStatus({ state: 'loading', data: 'remote' });
		const ok = await ensure_http();
		if (!ok) return;
		active_browser = http_browser;
		current_mode = 'http';
		setWorkerStatus({ state: 'ready', data: 'remote', metadata: http_metadata! });
		free_local();
	} else {
		setWorkerStatus({ state: 'loading', data: 'local' });
		const ok = await ensure_local();
		if (!ok) return;
		active_browser = local_browser;
		current_mode = 'local';
		setWorkerStatus({ state: 'ready', data: 'local', metadata: local_metadata! });
		free_http();
	}
}

async function perform_download(request: DownloadRequest) {
	free_local();

	if (current_mode !== 'http') {
		const ok = await ensure_http();
		if (ok) {
			active_browser = http_browser;
			current_mode = 'http';
			setWorkerStatus({ state: 'ready', data: 'remote', metadata: http_metadata! });
		}
	}

	const download = await download_db(request, (progress) => {
		QueryEventsChannel.postMessage({
			...progress,
			type: 'download-progress'
		});
	});

	if (download.status === 'error') {
		QueryEventsChannel.postMessage({
			type: 'download-complete',
			success: false,
			error: download
		});
	} else {
		QueryEventsChannel.postMessage({
			type: 'download-complete',
			success: true
		});
		perform_set_mode('local');
	}
}

QueryReqChannel.onmessage(async (event) => {
	await wasm_ready;
	await worker_task_queue;

	if (!active_browser) {
		console.warn('[worker] Dropped query: no active browser after transitions');
		return;
	}

	try {
		const resp = await handle_query_request(active_browser, event.data);
		QueryResChannel.postMessage(resp);
	} catch (err) {
		console.error('[worker] Query failed: ', err);
	}
});

QueryEventsChannel.onmessage((event) => {
	if (event.data.type === 'db-check') {
		QueryEventsChannel.postMessage({ type: 'db-status', status: worker_status });
	}
});

onmessage = (event) => {
	const msg: QueryWorkerMessage = event.data;

	// Enqueue these actions to prevent race conditions (e.g. OPFS lock conflicts)
	enqueue_task(async () => {
		await wasm_ready;
		switch (msg.action) {
			case 'set-mode': {
				await perform_set_mode(msg.mode);
				break;
			}
			case 'download': {
				await perform_download({ sources: msg.sources });
				break;
			}
			case 'destroy': {
				free_local();
				free_http();
				active_browser = null;
				current_mode = null;
				postMessage(undefined); // Acknowledge destruction safely
				break;
			}
		}
	});
};
