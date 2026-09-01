/// <reference lib="webworker" />
import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

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
	| ({
			status: 'error';
	  } & (OPFSError | JSONError | FetchError));

async function download_sources(request: DownloadRequest): Promise<DownloadResponse> {
	const tasks = request.sources.map((source) =>
		download_to_opfs(`${PUBLIC_PARQUET_LATEST}/${source.path}`, source.path)
	);

	tasks.push(download_to_opfs(`${PUBLIC_PARQUET_LATEST}/metadata.json`, 'metadata.json'));

	const results = await Promise.all(tasks);

	const firstError = results.find((error) => error !== null);

	if (firstError) {
		return { status: 'error', ...firstError };
	}

	return { status: 'success' };
}

onmessage = async (event) => {
	console.log('[download] starting download');
	const message = await download_sources(event.data);
	postMessage(message);
};
