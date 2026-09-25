import {
	get_local_settings,
	set_local_settings,
	get_default_local_settings,
	type LocalSettings
} from './settings-local.svelte';
export { get_local_settings, set_local_settings, get_default_local_settings, type LocalSettings };

import { use_settings, type VeldSettings } from './settings-merged.svelte';
export { use_settings, type VeldSettings };
