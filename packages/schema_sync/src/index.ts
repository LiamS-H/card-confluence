import * as Y from "yjs";

export const DECK_DOC_KEY = "doc";

export function createDeckDoc() {
	const doc = new Y.Doc();
	doc.getText(DECK_DOC_KEY);
	return doc;
}

export type DeckDoc = Y.Doc;
