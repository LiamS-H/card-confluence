import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

interface OpfsError {
	type: 'failed_to_fetch' | 'opfs_error';
	message: string;
}
const files = ['cards', 'sets', 'rulings'] as const;
const root = await navigator.storage.getDirectory();
export async function download_to_opfs(
	file_uri: string,
	opfs_file: string
): Promise<[FileSystemFileHandle, null] | [null, OpfsError]> {
	const response = await fetch(file_uri);

	if (!response.ok || !response.body)
		return [null, { type: 'failed_to_fetch', message: response.statusText }];

	try {
		const fileHandle = await root.getFileHandle(opfs_file, { create: true });

		const writableStream = await fileHandle.createWritable();

		await response.body.pipeTo(writableStream);

		return [fileHandle, null];
	} catch (e) {
		return [null, { type: 'opfs_error', message: `OPFS Error: ${e}` }];
	}
}

export async function sync_local_parquet() {
	const promises = [];
	for (const file of files) {
		promises.push(download_to_opfs(`${PUBLIC_PARQUET_LATEST}/${file}.parquet`, `${file}.parquet`));
	}
	const resolved = await Promise.all(promises);
	const handles = [];
	for (const [file, error] of resolved) {
		if (error) {
			return error;
		}
		handles.push(file);
	}
	const [cards, sets, rulings] = handles as [
		FileSystemFileHandle,
		FileSystemFileHandle,
		FileSystemFileHandle
	];

	return { cards, sets, rulings };
}

export async function get_local_parquet() {
	try {
		// this will fail when not present
		const handles = await Promise.all(files.map((file) => root.getFileHandle(`${file}.parquet`)));
		const [cards, sets, rulings] = handles as [
			FileSystemFileHandle,
			FileSystemFileHandle,
			FileSystemFileHandle
		];
		return { cards, sets, rulings };
	} catch {
		return sync_local_parquet();
	}
}
