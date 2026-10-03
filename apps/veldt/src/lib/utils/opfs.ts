import type { JSONError, OPFSError } from '$lib/errors';

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;
export function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
	if (!rootPromise) {
		rootPromise = navigator.storage.getDirectory();
	}
	return rootPromise;
}

export async function read_json_from_opfs<T>(
	opfs_file: string
): Promise<[T, null] | [null, OPFSError | JSONError]> {
	try {
		const root = await getOpfsRoot();
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
