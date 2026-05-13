import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
// import { WebsocketProvider } from 'y-websocket';
import { getDecksRoot, createDeck, type DecksRootMap } from '@repo/schema-sync';

import { Channel } from '$lib/utils/channel';
import { browser } from '$app/environment';

export interface YjsEvent {
	blob: Uint8Array<ArrayBufferLike>;
}

export const YjsEventChannel = new Channel<YjsEvent>('yjs-event');

class SyncClient {
	private doc = new Y.Doc();
	private root: DecksRootMap;
	private idb!: IndexeddbPersistence;

	constructor() {
		this.root = getDecksRoot(this.doc);

		YjsEventChannel.onmessage(({ data }) => {
			Y.applyUpdate(this.doc, data.blob, 'local-tab-sync');
		});

		this.doc.on('update', (update, origin) => {
			if (origin === 'local-tab-sync') {
				return;
			}
			YjsEventChannel.postMessage({ blob: update });
		});
	}
	private on_self_promotion: LockGrantedCallback<unknown> = async (lock) => {
		if (!lock) {
			return false;
		}
		// const wsProvider = new WebsocketProvider(
		// 	'wss://api.yourdomain.com/do-endpoint',
		// 	'per-user-room',
		// 	this.doc
		// );
	};

	public async init() {
		this.idb = new IndexeddbPersistence('per-user-room', this.doc);
		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);
		// run only when follower
	}

	public create_deck() {
		return createDeck(this.root, crypto.randomUUID());
	}

	public get_root() {
		return this.root;
	}
}

declare global {
	interface Window {
		__deck_client?: SyncClient;
	}
}

function get_or_create_client(): SyncClient {
	if (!browser) {
		return new SyncClient();
	}
	if (typeof window === 'undefined') {
		return new SyncClient();
	}

	if (!window.__deck_client) {
		const client = new SyncClient();
		window.__deck_client = client;
		client.init();
	}

	return window.__deck_client;
}

export const sync_client = get_or_create_client();
