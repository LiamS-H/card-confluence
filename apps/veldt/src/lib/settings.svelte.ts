//TODO: This localStorage implementation should represent local settings, other setting should be stored on the base yjs for the user
import { Channel } from './utils/channel';

const key = 'VeldtSettings';
export const VeldtSettingsChannel = new Channel<VeldtSettings>(key);

export interface VeldtSettings {
	database: {
		useLocal: boolean;
		askEachDownload: boolean;
	};
	cards: {
		variant: 'img' | 'tile';
	};
}

export function get_default_veldt_settings(): VeldtSettings {
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

function load_initial_settings(): VeldtSettings {
	if (typeof window === 'undefined') return get_default_veldt_settings();

	try {
		const string = window.localStorage.getItem(key);
		if (string) return JSON.parse(string);
	} catch {}

	const defaults = get_default_veldt_settings();
	window.localStorage.setItem(key, JSON.stringify(defaults));
	return defaults;
}

let shared_settings = $state<VeldtSettings>(load_initial_settings());

if (typeof window !== 'undefined') {
	VeldtSettingsChannel.onmessage((event) => {
		Object.assign(shared_settings, event.data || event);
	});
}

export function get_veldt_settings(): VeldtSettings {
	return shared_settings;
}

export function set_veldt_settings(settings: VeldtSettings) {
	// Update memory (instant UI update for current tab)
	Object.assign(shared_settings, settings);

	if (typeof window !== 'undefined') {
		// Persist to disk
		window.localStorage.setItem(key, JSON.stringify(settings));
		// Alert other tabs/workers
		VeldtSettingsChannel.postMessage(settings);
	}
}
