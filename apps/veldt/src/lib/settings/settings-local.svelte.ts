import { Channel } from '$lib/utils/channel';
import { deepAssign, type DeepPartial } from '$lib/utils/object';

const key = 'LocalSettings';
export const LocalSettingsChannel = new Channel<DeepPartial<LocalSettings>>(key);

export type CardVariant = 'img' | 'img-full' | 'tile';

export interface LocalSettings {
	database: {
		useLocal: boolean;
		inMemory: boolean;
		askEachDownload: boolean;
	};
	cards: {
		deckVariant: CardVariant;
		searchVariant: 'img-full' | 'tile';
	};
}

export function get_default_local_settings(): LocalSettings {
	return {
		database: {
			useLocal: false,
			inMemory: false,
			askEachDownload: true
		},
		cards: {
			deckVariant: 'img',
			searchVariant: 'img-full'
		}
	};
}

function load_initial_settings(): LocalSettings {
	if (typeof window === 'undefined') return get_default_local_settings();

	try {
		const string = window.localStorage.getItem(key);
		if (string) return JSON.parse(string);
	} catch {}

	const defaults = get_default_local_settings();
	window.localStorage.setItem(key, JSON.stringify(defaults));
	return defaults;
}

let shared_settings = $state<LocalSettings>(load_initial_settings());

if (typeof window !== 'undefined') {
	LocalSettingsChannel.onmessage((event) => {
		deepAssign(shared_settings, event.data);
	});
}

export function get_local_settings(): LocalSettings {
	return shared_settings;
}

export function set_local_settings(partial_settings: DeepPartial<LocalSettings>) {
	deepAssign(shared_settings, partial_settings);

	if (typeof window !== 'undefined') {
		const string = JSON.stringify(shared_settings);
		console.log('[settings] new ', string);
		window.localStorage.setItem(key, string);
		LocalSettingsChannel.postMessage(partial_settings);
	}
}
