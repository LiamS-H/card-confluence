import type { Print, Ruling, Card } from '@card-confluence/wasm-browser';

export function price_from_print(print: Print): string {
	if (print.prices.usd) {
		return '$' + print.prices.usd.toFixed(2);
	}

	if (print.prices.usd_foil) {
		return 'F$' + print.prices.usd_foil.toFixed(2);
	}

	if (print.prices.usd_etched) {
		return 'E$' + print.prices.usd_etched.toFixed(2);
	}

	if (print.prices.eur) {
		return '€' + print.prices.eur.toFixed(2);
	}
	if (print.prices.tix) {
		return print.prices.tix.toFixed(2) + 'T';
	}

	return '';
}

export interface GroupedRuling {
	oracle_id: string;
	source: string;
	published_at: string;
	comments: string[];
}

export function rulings_grouped(rulings: Ruling[]): GroupedRuling[] {
	if (rulings.length === 0) return [];

	const grouped = Map.groupBy(
		rulings,
		({ oracle_id, published_at, source }) => `${oracle_id}|${published_at}|${source}`
	);

	return Array.from(grouped.values(), (group) => {
		const { oracle_id, published_at } = group[0];
		return {
			oracle_id,
			source: [...new Set(group.map((r) => r.source))].sort().join(' & '),
			published_at,
			comments: group.map((r) => r.comment)
		};
	});
}

export function legalities_as_short_sorted(
	legalities: Card['legalities']
): { format: string; legality: string }[] {
	const shortened = Object.entries(legalities).map(([format, legality]) => ({
		format: format_as_shortened_string(format),
		legality
	}));
	const sorted = shortened.sort((a, b) => {
		const an = a.legality === 'not_legal';
		const bn = b.legality === 'not_legal';
		if (an && !bn) return 1;
		if (bn && !an) return -1;
		return a.format.localeCompare(b.format);
	});
	return sorted;
}

export function format_as_shortened_string(format: string): string {
	if (format === 'paupercommander') {
		return 'pauperEDH';
	}

	if (format === 'competetivebrawl') {
		return 'brawl-comp';
	}

	if (format === 'standardbrawl') {
		return 'brawl-std';
	}

	return format;
}
