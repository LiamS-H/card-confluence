import type { FetchError, JSONError, OPFSError } from '$lib/errors';

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;
function getRoot(): Promise<FileSystemDirectoryHandle> {
	if (!rootPromise) {
		rootPromise = navigator.storage.getDirectory();
	}
	return rootPromise;
}

export async function download_to_opfs(
	file_url: string,
	opfs_file: string
): Promise<OPFSError | FetchError | null> {
	let response: Response;
	try {
		response = await fetch(file_url);
	} catch {
		return { type: 'no_internet_error' };
	}

	if (!response.ok || !response.body) {
		return { type: 'fetch_error', message: response.statusText };
	}

	try {
		const root = await getRoot();
		const fileHandle = await root.getFileHandle(opfs_file, { create: true });

		const writableStream = await fileHandle.createWritable();

		await response.body.pipeTo(writableStream);
		// don't need to cleanup filehandle, can only be garbage collected

		return null;
	} catch (e) {
		return { type: 'opfs_error', message: `OPFS Error: ${e}` };
	}
}

export async function read_json_from_opfs<T>(
	opfs_file: string
): Promise<[T, null] | [null, OPFSError | JSONError]> {
	try {
		const root = await getRoot();
		const fileHandle = await root.getFileHandle(opfs_file, { create: true });

		const file = await fileHandle.getFile();
		const text = await file.text();

		const data = JSON.parse(text);

		return [data as T, null];
	} catch (e) {
		if (e instanceof SyntaxError) {
			return [null, { type: 'json_error', message: `JSON Error: ${e.message}` }];
		}
		return [null, { type: 'opfs_error', message: `OPFS Error: ${e}` }];
	}
}
