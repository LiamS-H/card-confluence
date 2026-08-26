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
	const dl_error = await download_to_opfs(
		`${PUBLIC_PARQUET_LATEST}/metadata.json`,
		'metadata.json'
	);

	if (dl_error !== null) {
		return { status: 'error', ...dl_error };
	}
	console.log('[download] downloading', request.sources);

	for (const source of request.sources) {
		const filename = source.path;
		console.log('[download] downloading', filename);
		const error = await download_to_opfs(`${PUBLIC_PARQUET_LATEST}/${filename}`, filename);
		if (error !== null) {
			return { status: 'error', ...error };
		}
		console.log('[download] downloaded', filename);
	}

	return { status: 'success' };
}

onmessage = async (event) => {
	console.log('[download] starting download');
	const message = await download_sources(event.data);
	postMessage(message);
};
