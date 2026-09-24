//TODO: This localStorage implementation should represent local settings, other setting should be stored on the base yjs for the user
import { Channel } from './utils/channel';

const key = 'LocalSettings';
export const LocalSettingsChannel = new Channel<LocalSettings>(key);

export interface LocalSettings {
	database: {
		useLocal: boolean;
		askEachDownload: boolean;
	};
	cards: {
		variant: 'img' | 'tile';
	};
}

export function get_default_local_settings(): LocalSettings {
	return {
		database: {
			useLocal: false,
			askEachDownload: true
		},
		cards: {
			variant: 'img'
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
		Object.assign(shared_settings, event.data || event);
	});
}

export function get_local_settings(): LocalSettings {
	return shared_settings;
}

export function set_local_settings(settings: LocalSettings) {
	const string = JSON.stringify(settings);
	const cleaned = JSON.parse(string);
	Object.assign(shared_settings, cleaned);

	if (typeof window !== 'undefined') {
		console.log('[settings] new ', string);
		window.localStorage.setItem(key, string);
		LocalSettingsChannel.postMessage(cleaned);
	}
}
