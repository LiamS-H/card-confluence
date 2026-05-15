import { QueryEventsChannel } from './channels';

const QUERY_CACHE_DB = 'query-cache';
export const QUERY_CACHE_TABLE = 'queries';

export type CacheKey = Uint8Array<ArrayBuffer>;
export type CacheValue = Uint8Array<ArrayBuffer>;

async function initCacheDB(): Promise<IDBDatabase> {
	const { resolve, reject, promise } = Promise.withResolvers<IDBDatabase>();

	if (!(typeof self !== 'undefined' && self.indexedDB)) {
		return null as unknown as IDBDatabase;
	}
	const db_req = indexedDB.open(QUERY_CACHE_DB, 1);

	db_req.onerror = () => {
		QueryEventsChannel.postMessage({ type: 'error-fatal', message: 'failed to open indexedDB' });
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
	k: CacheKey,
	store: IDBObjectStore
): Promise<CacheValue | null> {
	const request = store.get(k);
	return new Promise<CacheValue | null>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.result);
	});
}

export async function cache_store_insert(
	k: CacheKey,
	v: CacheValue,
	store: IDBObjectStore
): Promise<void> {
	const request = store.put(v, k);
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve();
		request.onerror = () => reject();
	});
}

export async function cache_get(k: CacheKey): Promise<Uint8Array<ArrayBuffer> | null> {
	const db = await local_cache;
	const tx = db.transaction(QUERY_CACHE_TABLE, 'readonly');
	const store = tx.objectStore(QUERY_CACHE_TABLE);
	const request = store.get(k);
	tx.commit();
	return new Promise<CacheValue | null>((resolve, reject) => {
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
