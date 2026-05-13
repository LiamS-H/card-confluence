import * as Y from "yjs";

export const DECKS_ROOT_KEY = "decks";

// need type safe accessors for doc, title, etc.
export type DeckStruct = Y.Map<Y.Text>;

export type DecksRootMap = Y.Map<DeckStruct>;

export function getDecksRoot(doc: Y.Doc): DecksRootMap {
    return doc.getMap<DeckStruct>(DECKS_ROOT_KEY);
}

export function createDeck(decksRoot: DecksRootMap, id: string): DeckStruct {
    const deckStruct = new Y.Map<Y.Text>();
    const textContent = new Y.Text();

    deckStruct.set("doc", textContent);
    decksRoot.set(id, deckStruct);

    return deckStruct;
}
