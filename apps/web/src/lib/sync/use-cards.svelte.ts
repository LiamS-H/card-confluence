import * as Y from 'yjs';
import { getContext, setContext } from 'svelte';
import { sync_client } from '$lib';

import type { DeckStruct, DeckCard, DeckZone, OracleCard } from '@repo/schema-sync';

const DECK_CARD_INTERFACE_KEY = Symbol('deck_card_interface');

export class DeckCardInterface {
	private deck: DeckStruct;

	// this is not ideal, since any change will update everything. But it works for now :p
	private sync_tick = $state(0);

	constructor(deck: DeckStruct) {
		this.deck = deck;

		this.deck.observeDeep(() => {
			this.sync_tick += 1;
		});
	}

	move_cards(oracle_id: string, zone: DeckZone, amount: number): void {
		const cards = this.deck.get('cards');
		const oracle_entry = cards.get(oracle_id);

		if (!oracle_entry) {
			throw new Error(`No oracle entry found for ${oracle_id}`);
		}

		const instances = oracle_entry.get('instances');
		if (!instances) return;

		let moved = 0;

		sync_client.get_doc().transact(() => {
			for (const [y_id, card] of instances.entries()) {
				if (moved >= amount) break;

				if (card.zone !== zone) {
					instances.set(y_id, { ...card, zone });
					moved++;
				}
			}
		});
	}

	public add_cards(oracle_id: string, scryfall_id: string, zone: DeckZone, amount: number): void {
		sync_client.get_doc().transact(() => {
			const cards = this.deck.get('cards');
			let oracle_entry = cards.get(oracle_id);

			if (!oracle_entry) {
				oracle_entry = new Y.Map() as OracleCard;
				oracle_entry.set('instances', new Y.Map<DeckCard>());
				cards.set(oracle_id, oracle_entry);
			}

			const instances = oracle_entry.get('instances');

			for (let _ = 0; _ < amount; _++) {
				const y_id = crypto.randomUUID();
				instances.set(y_id, { y_id, oracle_id, scryfall_id, zone });
			}
		});
	}

	private get_cards_by_zone(target_zone: DeckZone): DeckCard[] {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used for reactivity
		this.sync_tick;
		const result: DeckCard[] = [];
		const cards = this.deck.get('cards');

		if (!cards) return result;

		cards.forEach((oracle_entry) => {
			const instances = oracle_entry.get('instances');
			if (instances) {
				instances.forEach((card) => {
					if (card.zone === target_zone) result.push(card);
				});
			}
		});
		return result;
	}

	get main_deck() {
		return this.get_cards_by_zone('mainboard');
	}
	get sideboard() {
		return this.get_cards_by_zone('sideboard');
	}
	get considering() {
		return this.get_cards_by_zone('considering');
	}
	get commander() {
		return this.get_cards_by_zone('commander');
	}
}

export function use_deck_cards_provider(getDeck: () => DeckStruct): DeckCardInterface {
	const deck_interface = $derived(new DeckCardInterface(getDeck()));
	setContext(DECK_CARD_INTERFACE_KEY, deck_interface);
	return deck_interface;
}

export function use_deck_cards(): DeckCardInterface {
	return getContext(DECK_CARD_INTERFACE_KEY) as DeckCardInterface;
}
