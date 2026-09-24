import * as Y from 'yjs';

export const DECKS_ROOT_KEY = 'decks';

export type DeckSerialized = {
	title: string;
	doc: string;
	cards: { [key: string]: { instances: DeckCard[] } };
};

export type DeckZone = 'mainboard' | 'sideboard' | 'considering' | 'commander';

// @ts-ignore; for the this declaration
export interface OracleCard extends Y.Map<any> {
	get(key: 'instances'): Y.Map<DeckCard>;
	set(key: 'instances', value: Y.Map<DeckCard>): this;
	// Add future stuff here later:
	// get(key: "custom_cost"): Y.Text;
}

export interface OracleCardSerialized {
	instances: DeckCard[];
	oracle_id: string;
}

export interface DeckCard {
	y_id: string;
	oracle_id: string;
	scryfall_id: string;
	zone: DeckZone;
}

/**
 * DeckStruct represents the Yjs Map for a single deck.
 * It contains:
 * - title: Y.Text
 * - doc: Y.Text (the deck content)
 */
export interface DeckStruct extends Y.Map<any> {
	get(key: 'title'): Y.Text;
	set(key: 'title', value: Y.Text): this;
	get(key: 'doc'): Y.Text;
	set(key: 'doc', value: Y.Text): this;
	get(key: 'cards'): Y.Map<OracleCard>;
	set(key: 'cards', value: Y.Map<OracleCard>): this;
	toJSON(): DeckSerialized;
}

export type DecksRootMap = Y.Map<DeckStruct>;

export function getDecksRoot(doc: Y.Doc): DecksRootMap {
	return doc.getMap<DeckStruct>(DECKS_ROOT_KEY);
}

export function createDeck(decksRoot: DecksRootMap, id: string, title?: string): DeckStruct {
	const deckStruct = new Y.Map<Y.Text>() as DeckStruct;

	deckStruct.set('title', new Y.Text(title ?? 'Unnamed'));
	deckStruct.set('doc', new Y.Text());
	deckStruct.set('cards', new Y.Map());
	decksRoot.set(id, deckStruct);

	return deckStruct;
}

export function createDecksDoc(): Y.Doc {
	const doc = new Y.Doc();
	return doc;
}

export class DeckMutationInterface {
	constructor(
		private doc: Y.Doc,
		private deck: DeckStruct
	) {}

	move_cards(oracle_id: string, src: DeckZone, dest: DeckZone, amount: number): void {
		const cards = this.deck.get('cards');
		const oracle_entry = cards.get(oracle_id);

		if (!oracle_entry) {
			throw Error(`No oracle entry found for ${oracle_id}`);
		}

		const instances = oracle_entry.get('instances');
		if (!instances) return;

		let moved = 0;

		this.doc.transact(() => {
			for (const [y_id, card] of instances.entries()) {
				if (moved >= amount) break;

				if (card.zone === src) {
					instances.set(y_id, { ...card, zone: dest });
					moved++;
				}
			}
		});
	}

	remove_cards(oracle_id: string, zone: DeckZone, amount: number): void {
		const cards = this.deck.get('cards');
		const oracle_entry = cards.get(oracle_id);
		if (!oracle_entry) return;

		const instances = oracle_entry.get('instances');
		if (!instances) return;

		let deleted = 0;

		this.doc.transact(() => {
			for (const [y_id, card] of instances.entries()) {
				if (deleted >= amount) break;

				if (card.zone === zone) {
					instances.delete(y_id);
					deleted++;
				}
			}

			if (instances.size === 0) {
				cards.delete(oracle_id);
			}
		});
	}

	public add_cards(oracle_id: string, scryfall_id: string, zone: DeckZone, amount: number): void {
		this.doc.transact(() => {
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
}
