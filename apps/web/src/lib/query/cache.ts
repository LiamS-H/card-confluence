import { QueryEventsChannel } from './channels';

const QUERY_CACHE_DB = 'query-cache';
export const QUERY_CACHE_TABLE = 'queries';

async function initCacheDB(): Promise<IDBDatabase> {
	const { resolve, reject, promise } = Promise.withResolvers<IDBDatabase>();

	if (!(typeof self !== 'undefined' && self.indexedDB)) {
		return null as unknown as IDBDatabase;
	}
	const db_req = indexedDB.open(QUERY_CACHE_DB, 1);

	db_req.onerror = () => {
		QueryEventsChannel.postMessage({ type: 'error-fatal' });
		reject();
	};

	db_req.onupgradeneeded = (e) => {
		const db = (e.target as IDBOpenDBRequest).result;
		db.createObjectStore(QUERY_CACHE_TABLE);
	};
	db_req.onsuccess = () => {
		resolve(db_req.result);
	};
	return promise;
}

export const local_cache = initCacheDB();

export async function cache_store_get(
	k: Uint8Array<ArrayBuffer>,
	store: IDBObjectStore
): Promise<Uint8Array<ArrayBuffer> | null> {
	const request = store.get(k);
	return new Promise<Uint8Array<ArrayBuffer> | null>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.result);
	});
}

export async function cache_store_insert(
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

export async function cache_get(
	k: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer> | null> {
	const db = await local_cache;
	const tx = db.transaction(QUERY_CACHE_TABLE, 'readonly');
	const store = tx.objectStore(QUERY_CACHE_TABLE);
	const request = store.get(k);
	tx.commit();
	return new Promise<Uint8Array<ArrayBuffer> | null>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.result);
	});
}

export async function cache_clear(): Promise<void> {
	const db = await local_cache;
	const tx = db.transaction(QUERY_CACHE_TABLE, 'readwrite');
	const store = tx.objectStore(QUERY_CACHE_TABLE);
	const request = store.clear();
	tx.commit();
	return new Promise<void>((resolve, reject) => {
		request.onsuccess = () => resolve();
		request.onerror = () => reject();
	});
}
