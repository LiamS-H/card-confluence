// TODO: Add functionality to make this the unified way to grab settings
// this means local settings will not longer have extensive defaults, and instead represent overriding the defaults in the config
import { use_config } from '$lib/sync/use-config.svelte';
import { DeckCardInterface, use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
import { get_local_settings, type CardVariant } from './settings-local.svelte';

export interface VeldSettings {
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
export function use_settings(): VeldSettings {
	const deck = use_deck_cards();
	return get_settings(deck);
}

/** for syncronous access to the same data as use_settings, require manual deck context */
export function get_settings(deck: DeckCardInterface | null): VeldSettings {
	const base = use_config();
	const local = get_local_settings();

	// @ts-expect-error; merging like this inherently can't be type safe
	return new Proxy(
		{},
		{
			get(_, category) {
				return new Proxy(
					{},
					{
						get(_, setting) {
							return (
								// @ts-expect-error
								deck?.settings_overrides[category]?.[setting] ??
								// @ts-expect-error
								local[category]?.[setting] ??
								// @ts-expect-error
								base.configData[category]?.[setting]
							);
						}
					}
				);
			}
		}
	);
}
