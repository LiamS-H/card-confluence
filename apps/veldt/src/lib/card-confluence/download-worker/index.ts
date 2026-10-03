/// <reference lib="webworker" />
const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

import type { OPFSError, JSONError, FetchError } from '$lib/errors';
import { getOpfsRoot } from '$lib/utils/opfs';
import type { MetaDataSource } from '@card-confluence/wasm-browser';

export async function download_to_opfs(
	file_url: string,
	opfs_file: string
): Promise<OPFSError | FetchError | null> {
	let response: Response;
	try {
		response = await fetch(file_url);
	} catch {
		return { type: 'no_internet_error', message: '' };
	}

	if (!response.ok || !response.body) {
		return {
			type: 'fetch_error',
			status_code: response.status,
			message: `failed to fetch url:${file_url} ${JSON.stringify(response)}`
		};
	}

	try {
		const root = await getOpfsRoot();
		const fileHandle = await root.getFileHandle(opfs_file, { create: true });

		const writableStream = await fileHandle.createWritable();

		await response.body.pipeTo(writableStream);
		// don't need to cleanup filehandle, can only be garbage collected

		return null;
	} catch (e) {
		if (e instanceof TypeError) {
			return { type: 'no_internet_error', message: `Network Error: ${e.message}` };
		}

		// File system setup or write failures
		if (e instanceof DOMException) {
			return { type: 'opfs_error', message: `OPFS Error: ${e.name} - ${e.message}` };
		}
		return { type: 'opfs_error', message: `Unknown Error: ${e}` };
	}
}

export interface DownloadRequest {
	sources: MetaDataSource[];
}

export type DownloadResponse =
	| {
			status: 'success';
	  }
	| ({
			status: 'error';
	  } & (OPFSError | JSONError | FetchError | { type: 'worker-error'; message: string }));

export type DownloadMessage =
	| {
			status: 'progress';
			downloaded: number;
			total: number;
	  }
	| DownloadResponse;

async function download_sources(request: DownloadRequest): Promise<void> {
	const all_paths = [...request.sources.map((source) => source.path), 'metadata.json'];
	const total = all_paths.length;
	let downloaded = 0;

	console.log('[download] downloading', all_paths);
	for (const path of all_paths) {
		const url = `${PUBLIC_PARQUET_LATEST}/${path}`;

		console.log('[download] downloading', path);
		const error = await download_to_opfs(url, path);

		if (error) {
			console.error('[download] download error', error);
			postMessage({ status: 'error', ...error } satisfies DownloadMessage);
			return;
		}
		console.log('[download] downloaded', path);

		downloaded++;
		postMessage({ status: 'progress', downloaded, total } satisfies DownloadMessage);
	}

	postMessage({ status: 'success' } satisfies DownloadMessage);
	console.log('[download] finished');
}

console.log('[download] init');

onmessage = async (event) => {
	console.log('[download] starting download');
	await download_sources(event.data);
};
