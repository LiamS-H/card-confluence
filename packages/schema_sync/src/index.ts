import * as Y from "yjs";

export const DECKS_ROOT_KEY = "decks";

export type DeckSerialized = {
    title: string;
    doc: string;
};

/**
 * DeckStruct represents the Yjs Map for a single deck.
 * It contains:
 * - title: Y.Text
 * - doc: Y.Text (the deck content)
 */
export interface DeckStruct extends Y.Map<Y.Text> {
    get(key: "title"): Y.Text;
    get(key: "doc"): Y.Text;
    set(key: "title", value: Y.Text): this;
    set(key: "doc", value: Y.Text): this;
    toJSON(): DeckSerialized;
}

export type DecksRootMap = Y.Map<DeckStruct>;

export function createDeckDoc(): Y.Doc {
    const doc = new Y.Doc();
    getDecksRoot(doc);
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

    deckStruct.set("doc", new Y.Text());
    deckStruct.set("title", new Y.Text(title ?? "Unnamed"));
    decksRoot.set(id, deckStruct);

    return deckStruct;
}

export function serializeDeck(deck: DeckStruct): DeckSerialized {
    return deck.toJSON();
}

