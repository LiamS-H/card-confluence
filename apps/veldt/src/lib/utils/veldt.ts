import type { Deck } from 'codemirror-lang-veldt-deck';

export function query_with_domain(deck: Deck, query: string) {
	return `${deck.domain} (${query})`;
}
