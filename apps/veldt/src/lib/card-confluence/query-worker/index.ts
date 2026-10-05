////// <reference lib="webworker" />

import init, { CardConfluenceBrowser, type MetaData } from '@card-confluence/wasm-browser';

import { QueryEventsChannel, QueryReqChannel, QueryResChannel } from '../channels';
import {
	handle_query_request,
	setWorkerStatus,
	worker_status,
	type DBStatus,
	type QueryWorkerMessage
} from './shared';
import { get_remote_metadata, get_opfs_metadata } from '../db-meta';
import { download_db } from '../download-worker/factory';
import type { DownloadRequest } from '../download-worker';

const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

const wasm_ready = init();

type Mode = 'http' | 'local' | 'local_mem';

interface Session {
	mode: Mode;
	browser: CardConfluenceBrowser;
	metadata: MetaData;
}

type OpenResult = { browser: CardConfluenceBrowser; metadata: MetaData } | { error: string };

interface ModeConfig {
	source: 'remote' | 'local';
	pending: 'connecting' | 'processing';
	open: () => Promise<OpenResult>;
}

async function open_http(): Promise<OpenResult> {
	const [metadata, error] = await get_remote_metadata(PUBLIC_PARQUET_LATEST);
	if (error) {
		return { error: `Http error, unable to read metadata.json ${JSON.stringify(error)}` };
	}
	const browser = await CardConfluenceBrowser.new_http(PUBLIC_PARQUET_LATEST, metadata);
	return { browser, metadata };
}

function open_opfs(create: (metadata: MetaData) => Promise<CardConfluenceBrowser>) {
	return async (): Promise<OpenResult> => {
		const [metadata, error] = await get_opfs_metadata();
		if (error) {
			return { error: `OPFS error, unable to read metadata.json ${error}` };
		}
		return { browser: await create(metadata), metadata };
	};
}

const MODES: Record<Mode, ModeConfig> = {
	http: { source: 'remote', pending: 'connecting', open: open_http },
	local: {
		source: 'local',
		pending: 'processing',
		open: open_opfs((m) => CardConfluenceBrowser.new_opfs(m))
	},
	local_mem: {
		source: 'local',
		pending: 'processing',
		open: open_opfs((m) => CardConfluenceBrowser.new_opfs_in_memory(m))
	}
};

const is_opfs = (mode: Mode) => MODES[mode].source === 'local';
let session: Session | null = null;

function release_session() {
	session?.browser.free();
	session = null;
}

async function set_mode(mode: Mode) {
	if (session?.mode === mode) return;

	const { source, pending, open } = MODES[mode];

	// OPFS handles are exclusive, so the old one must go before a new one opens.
	if (session && is_opfs(session.mode) && is_opfs(mode)) {
		release_session();
	}

	setWorkerStatus({ state: pending, data: source } as DBStatus);

	let result: OpenResult;
	try {
		result = await open();
	} catch (err) {
		result = { error: `Failed to open ${mode} db: ${err}` };
	}

	if ('error' in result) {
		setWorkerStatus({ state: 'error', data: source, message: result.error });
		return;
	}

	release_session();
	session = { mode, ...result };
	setWorkerStatus({ state: 'ready', data: source, metadata: result.metadata });
}

/** Release local files so the downloader can write them, and read over http meanwhile. */
async function perform_download(request: DownloadRequest) {
	if (session && session.mode !== 'http') release_session();
	await set_mode('http');

	const download = await download_db(request, (progress) => {
		QueryEventsChannel.postMessage({
			type: 'db-status',
			status: { state: 'downloading', data: 'remote', ...progress }
		});
	});

	if (download.status === 'error') {
		QueryEventsChannel.postMessage({ type: 'download-complete', success: false, error: download });
		return;
	}

	QueryEventsChannel.postMessage({ type: 'download-complete', success: true });
	await set_mode('local');
}

let worker_task_queue: Promise<void> = Promise.resolve();

/** Serialises lifecycle actions to prevent races (e.g. OPFS lock conflicts). */
function enqueue_task<T>(task: () => Promise<T>): Promise<T> {
	const next = worker_task_queue.then(task);
	worker_task_queue = next.then(
		() => {},
		(err) => console.error('[worker] task failed:', err)
	);
	return next;
}

QueryReqChannel.onmessage(async (event) => {
	await wasm_ready;
	await worker_task_queue;

	if (!session) {
		console.warn('[worker] Dropped query: no active browser after transitions');
		return;
	}

	try {
		QueryResChannel.postMessage(await handle_query_request(session.browser, event.data));
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

	enqueue_task(async () => {
		await wasm_ready;
		switch (msg.action) {
			case 'set-mode':
				return set_mode(msg.mode);
			case 'download':
				return perform_download({ sources: msg.sources });
			case 'destroy':
				release_session();
				postMessage(undefined); // lets the client know destruction succeeded
				return;
		}
	});
};
