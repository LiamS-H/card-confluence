import { ClientEventsChannel } from '../channels';

async function initCacheDB(): Promise<IDBDatabase> {
	const { resolve, reject, promise } = Promise.withResolvers<IDBDatabase>();

	const db_req = indexedDB.open('query-cache', 1);

	db_req.onerror = () => {
		ClientEventsChannel.postMessage({ type: 'error-fatal' });
		reject();
	};

	db_req.onupgradeneeded = (e) => {
		const db = (e.target as IDBOpenDBRequest).result;
		db.createObjectStore('queries');
	};
	db_req.onsuccess = () => {
		resolve(db_req.result);
	};

	return promise;
}

export const local_cache = initCacheDB();

export async function cache_get(
	k: Uint8Array<ArrayBuffer>,
	store: IDBObjectStore
): Promise<Uint8Array<ArrayBuffer> | null> {
	const request = store.get(k);
	return new Promise<Uint8Array<ArrayBuffer> | null>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.result);
	});
}

export async function cache_insert(
	k: Uint8Array<ArrayBuffer>,
	v: Uint8Array<ArrayBuffer>,
	store: IDBObjectStore
): Promise<void> {
	const request = store.put(v, k);
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve();
		request.onerror = () => reject();
	});
}
