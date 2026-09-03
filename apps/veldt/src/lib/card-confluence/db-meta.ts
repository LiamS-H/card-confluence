import type { FetchError, JSONError } from '$lib/errors';
import { read_json_from_opfs } from '$lib/utils/opfs';
import type { MetaData } from '@card-confluence/wasm-browser';

export async function get_remote_metadata(
	url: string
): Promise<[MetaData, null] | [null, JSONError | FetchError]> {
	let response: Response;

	try {
		response = await fetch(`${url}/metadata.json`);
	} catch (e) {
		return [null, { type: 'no_internet_error' }];
	}

	if (!response.ok || !response.body) {
		return [
			null,
			{
				type: 'fetch_error',
				status_code: response.status,
				message: `failed to fetch url:${url} ${JSON.stringify(response)}`
			}
		];
	}

	let data: MetaData;
	try {
		data = await response.json();
	} catch (e) {
		return [null, { type: 'json_error', message: `JSON Error: ${e}` }];
	}
	return [data, null];
}

export function get_opfs_metadata(): ReturnType<typeof read_json_from_opfs<MetaData>> {
	return read_json_from_opfs('metadata.json');
}

export function compare_metadata(current: MetaData, update: MetaData): MetaData {
	const out: MetaData = {
		...update,
		sources: []
	};
	for (const new_source of update.sources) {
		const old_source = current.sources.find((old) => old.table === new_source.table);

		if (!old_source) {
			out.sources.push(new_source);
			continue;
		}

		if (new_source.iso > old_source.iso) {
			out.sources.push(new_source);
		}
	}
	return out;
}
