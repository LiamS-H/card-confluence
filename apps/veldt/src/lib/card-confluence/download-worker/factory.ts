import DownLoadWorker from '$lib/card-confluence/download-worker?worker';
import type { DownloadRequest, DownloadResponse } from '.';

export function download_db(request: DownloadRequest): Promise<DownloadResponse> {
	const { promise, resolve } = Promise.withResolvers<DownloadResponse>();
	const worker = new DownLoadWorker();

	worker.onmessage = (event: MessageEvent<DownloadResponse>) => {
		resolve(event.data);
		worker.terminate();
	};
	worker.postMessage(request);
	return promise;
}
