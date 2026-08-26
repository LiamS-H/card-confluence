// settings.svelte.ts
import { Channel } from './utils/channel';

const key = 'VeldtSettings';
export const VeldtSettingsChannel = new Channel<VeldtSettings>(key);

export interface VeldtSettings {
	database: {
		useLocal: boolean;
		askEachDownload: boolean;
	};
}

export function get_default_veldt_settings(): VeldtSettings {
	return {
		database: {
			useLocal: false,
			askEachDownload: true
		}
	};
}

// 1. Initial disk read (runs once on import)
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

// 2. Reactive in-memory state
let shared_settings = $state<VeldtSettings>(load_initial_settings());

// 3. Listen for changes from other tabs/workers
if (typeof window !== 'undefined') {
	VeldtSettingsChannel.onmessage((event) => {
		shared_settings = event.data || event;
	});
}

// 4. Synchronous consumer getter
export function get_veldt_settings(): VeldtSettings {
	return shared_settings;
}

// 5. Unified setter
export function set_veldt_settings(settings: VeldtSettings) {
	// Update memory (instant UI update for current tab)
	shared_settings = settings;

	if (typeof window !== 'undefined') {
		// Persist to disk
		window.localStorage.setItem(key, JSON.stringify(settings));
		// Alert other tabs/workers
		VeldtSettingsChannel.postMessage(settings);
	}
}
