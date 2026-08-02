import { PUBLIC_PARQUET_LATEST } from '$env/static/public';

interface OpfsError {
	type: 'failed_to_fetch' | 'opfs_error';
	message: string;
}
const files = ['cards', 'prints', 'sets', 'rulings'] as const;
let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;
function getRoot(): Promise<FileSystemDirectoryHandle> {
	if (!rootPromise) {
		rootPromise = navigator.storage.getDirectory();
	}
	return rootPromise;
}

export async function download_to_opfs(
	file_uri: string,
	opfs_file: string
): Promise<[FileSystemFileHandle, null] | [null, OpfsError]> {
	const response = await fetch(file_uri);

	if (!response.ok || !response.body)
		return [null, { type: 'failed_to_fetch', message: response.statusText }];

	try {
		const root = await getRoot();
		const fileHandle = await root.getFileHandle(opfs_file, { create: true });

		const writableStream = await fileHandle.createWritable();

		await response.body.pipeTo(writableStream);

		return [fileHandle, null];
	} catch (e) {
		return [null, { type: 'opfs_error', message: `OPFS Error: ${e}` }];
	}
}

export async function sync_local_parquet() {
	console.log('[parquet] getting latest parquet files...');
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
	const [cards, prints, sets, rulings] = handles as [
		FileSystemFileHandle,
		FileSystemFileHandle,
		FileSystemFileHandle,
		FileSystemFileHandle
	];

	console.log('[parquet] latest files downloaded.');
	return { cards, prints, sets, rulings };
}

export async function get_local_parquet() {
	try {
		// this will fail when not present
		const root = await getRoot();
		const handles = await Promise.all(files.map((file) => root.getFileHandle(`${file}.parquet`)));
		const [cards, prints, sets, rulings] = handles as [
			FileSystemFileHandle,
			FileSystemFileHandle,
			FileSystemFileHandle,
			FileSystemFileHandle
		];
		return { cards, prints, sets, rulings };
	} catch {
		return sync_local_parquet();
	}
}
