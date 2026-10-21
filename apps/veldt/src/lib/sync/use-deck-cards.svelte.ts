import { sync_client } from '$lib';

import type { DeckStruct, DeckCard, DeckZone, OracleCardSerialized } from '@repo/schema-sync';
import { DeckMutationInterface } from '@repo/schema-sync';

export class DeckCardInterface {
	private deck: DeckStruct;
	private _mutate: DeckMutationInterface;

	// this is not ideal, since any change will update everything. But it works for now :p
	private sync_tick = $state(0);

	constructor(deck: DeckStruct) {
		this.deck = deck;
		this._mutate = new DeckMutationInterface(sync_client.doc, deck);

		this.deck.observeDeep(() => {
			this.sync_tick += 1;
		});
	}

	private get_cards_by_zone(target_zone: DeckZone): OracleCardSerialized[] {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used for reactivity
		this.sync_tick;
		const result: OracleCardSerialized[] = [];
		const cards = this.deck.get('cards');

		if (!cards) return result;

		cards.forEach((oracle_entry, oracle_id) => {
			const instances = oracle_entry.get('instances');
			const cards: DeckCard[] = [];
			instances.forEach((card) => {
				if (card.zone === target_zone) cards.push(card);
			});
			if (cards.length > 0) {
				result.push({ instances: cards, oracle_id });
			}
		});
		return result;
	}

	get_card_counts(oracle_id: string): Record<DeckZone | 'total', number> {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		this.sync_tick;

		const counts: Record<DeckZone | 'total', number> = {
			mainboard: 0,
			sideboard: 0,
			considering: 0,
			commander: 0,
			total: 0
		};

		const cards = this.deck.get('cards');
		if (!cards) return counts;

		const oracle_entry = cards.get(oracle_id);
		if (!oracle_entry) return counts;

		const instances = oracle_entry.get('instances');
		if (instances) {
			instances.forEach((card) => {
				counts[card.zone]++;
				counts['total']++;
			});
		}

		return counts;
	}

	get mutate() {
		return this._mutate;
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
