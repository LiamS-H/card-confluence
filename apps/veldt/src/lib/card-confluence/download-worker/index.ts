/// <reference lib="webworker" />
const PUBLIC_PARQUET_LATEST = import.meta.env.VITE_PUBLIC_PARQUET_LATEST;

import type { OPFSError, JSONError, FetchError } from '$lib/errors';
import type { MetaDataSource } from '@card-confluence/wasm-browser';
import { download_to_opfs } from '$lib/utils/opfs';

export interface DownloadRequest {
	sources: MetaDataSource[];
}

export type DownloadResponse =
	| {
			status: 'success';
	  }
	| {
			status: 'progress';
			downloaded: number;
			total: number;
	  }
	| ({
			status: 'error';
	  } & (OPFSError | JSONError | FetchError));

async function download_sources(request: DownloadRequest): Promise<void> {
	const all_paths = [
		...request.sources.map((source) => source.path),
		'metadata.json'
	];
	const total = all_paths.length;
	let downloaded = 0;

	for (const path of all_paths) {
		const url = path === 'metadata.json'
			? `${PUBLIC_PARQUET_LATEST}/metadata.json`
			: `${PUBLIC_PARQUET_LATEST}/${path}`;

		const error = await download_to_opfs(url, path);

		if (error) {
			postMessage({ status: 'error', ...error } satisfies DownloadResponse);
			return;
		}

		downloaded++;
		postMessage({ status: 'progress', downloaded, total } satisfies DownloadResponse);
	}

	postMessage({ status: 'success' } satisfies DownloadResponse);
}

onmessage = async (event) => {
	console.log('[download] starting download');
	await download_sources(event.data);
};
