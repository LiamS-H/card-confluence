import * as Y from "yjs";

export const DECKS_ROOT_KEY = "decks";

export type DeckSerialized = {
    title: string;
    doc: string;
};

export type DeckZone = "mainboard" | "sideboard" | "considering" | "commander";

// @ts-ignore
export interface OracleCard extends Y.Map<any> {
    get(key: "instances"): Y.Map<DeckCard>;
    set(key: "instances", value: Y.Map<DeckCard>): this;
    // Add future stuff here later:
    // get(key: "custom_cost"): Y.Text;
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
    get(key: "title"): Y.Text;
    set(key: "title", value: Y.Text): this;
    get(key: "doc"): Y.Text;
    set(key: "doc", value: Y.Text): this;
    get(key: "cards"): Y.Map<OracleCard>;
    set(key: "cards", value: Y.Map<OracleCard>): this;
    toJSON(): DeckSerialized;
}

export type DecksRootMap = Y.Map<DeckStruct>;

export function createDecksDoc(): Y.Doc {
    const doc = new Y.Doc();
    return doc;
}

export function getDecksRoot(doc: Y.Doc): DecksRootMap {
    return doc.getMap<DeckStruct>(DECKS_ROOT_KEY);
}

export function createDeck(
    decksRoot: DecksRootMap,
    id: string,
    title?: string,
): DeckStruct {
    const deckStruct = new Y.Map<Y.Text>() as DeckStruct;

    deckStruct.set("title", new Y.Text(title ?? "Unnamed"));
    deckStruct.set("doc", new Y.Text());
    deckStruct.set("cards", new Y.Map());
    decksRoot.set(id, deckStruct);

    return deckStruct;
}
