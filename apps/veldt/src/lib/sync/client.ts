import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
// import { WebsocketProvider } from 'y-websocket';
import {
	getDecksRoot,
	createDeck,
	type DecksRootMap,
	type ConfigStruct,
	getConfigRoot
} from '@repo/schema-sync';

import { Channel } from '$lib/utils/channel';
import { browser } from '$app/environment';

export interface YjsEvent {
	blob: Uint8Array<ArrayBufferLike>;
}

export const YjsEventChannel = new Channel<YjsEvent>('yjs-event');

class SyncClient {
	private _doc = new Y.Doc();
	private _decks_root: DecksRootMap;
	private _config_root: ConfigStruct;
	private idb!: IndexeddbPersistence;

	constructor() {
		this._decks_root = getDecksRoot(this._doc);
		this._config_root = getConfigRoot(this._doc);

		YjsEventChannel.onmessage(({ data }) => {
			Y.applyUpdate(this._doc, data.blob, 'local-tab-sync');
		});

		this._doc.on('update', (update, origin) => {
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
		this.idb = new IndexeddbPersistence('per-user-room', this._doc);
		await navigator.locks.request(
			'db-leader-lock',
			{ ifAvailable: true }, // exit early when not free so that initiation can proceed. this will never resolve when lock succeeds.
			this.on_self_promotion
		);
		// run only when follower
	}

	public create_deck(): string {
		const id = crypto.randomUUID();
		setTimeout(() => createDeck(this._decks_root, id), 0);
		return id;
	}

	get doc() {
		return this._doc;
	}
	get decks_root() {
		return this._decks_root;
	}

	get config_root() {
		return this._config_root;
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
