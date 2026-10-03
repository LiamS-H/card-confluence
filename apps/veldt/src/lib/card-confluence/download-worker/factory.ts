import DownLoadWorker from '$lib/card-confluence/download-worker?worker';
import type { DownloadRequest, DownloadMessage, DownloadResponse } from '.';

export interface DBProgress {
	downloaded: number;
	total: number;
}

export function download_db(
	request: DownloadRequest,
	progress: (prog: DBProgress) => void
): Promise<DownloadResponse> {
	const { promise, resolve } = Promise.withResolvers<DownloadResponse>();
	const worker = new DownLoadWorker();

	worker.postMessage(request);

	worker.onmessage = async (event: MessageEvent<DownloadMessage>) => {
		const data = event.data;
		if (data.status === 'progress') {
			progress;
			return;
		}

		worker.terminate();

		resolve(data);
	};

	worker.onerror = (e) => {
		console.error('[worker] download sub-worker error:', e);
		worker.terminate();
		resolve({
			type: 'worker-error',
			status: 'error',
			message: `${e}`
		});
	};

	return promise;
}
