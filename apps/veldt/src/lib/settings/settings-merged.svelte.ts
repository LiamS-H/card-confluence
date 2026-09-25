// TODO: Add functionality to make this the unified way to grab settings
// this means local settings will not longer have extensive defaults, and instead represent overriding the defaults in the config
import { use_config } from '$lib/sync/use-config.svelte';
import { use_deck_cards } from '$lib/sync/use-deck-cards.svelte';
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

export function use_settings(): VeldSettings {
	const base = use_config();
	//start with config as base
	const local = get_local_settings();
	// merge local settings
	const deck = use_deck_cards();
	if (deck) {
		//merge deck.settings
	}

	return local;
}

// for syncornous access to the same data as use_settings
export function get_settings(): VeldSettings {
	const base = use_config();
	//start with config as base
	const local = get_local_settings();
	// merge local settings
	const deck = use_deck_cards();

	return local;
}
