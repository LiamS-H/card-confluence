// TODO: Add functionality to make this the unified way to grab settings
// this means local settings will not longer have extensive defaults, and instead represent overriding the defaults in the config
import { use_config } from '$lib/sync/use-config.svelte';
import { use_deck_edit, type DeckEditInterface } from '$lib/editor';
import { get_local_settings, type CardVariant } from './settings-local.svelte';

export interface VeldtSettings {
	database: {
		useLocal: boolean;
		askEachDownload: boolean;
	};
	cards: {
		deckVariant: CardVariant;
		searchVariant: CardVariant;
	};
}

/** get a reactive state for the current settings, only run inside component initializatoin (pulls in deck context)  */
export function use_settings(): VeldtSettings {
	const deck = use_deck_edit();
	return get_settings(deck);
}

/** for syncronous access to the same data as use_settings, require manual deck context */
export function get_settings(deck: DeckEditInterface | null): VeldtSettings {
	const base = use_config();
	const local = get_local_settings();

	// @ts-expect-error; merging like this inherently can't be type safe
	return new Proxy(
		{},
		{
			get(_, category: keyof VeldtSettings) {
				return new Proxy(
					{},
					{
						get(_, setting: keyof VeldtSettings[keyof VeldtSettings]) {
							return (
								deck?.settings_overrides[category]?.[setting] ?? local[category]?.[setting]
								// ?? base.configData.settings[category]?.[setting]
							);
						}
					}
				);
			}
		}
	);
}
