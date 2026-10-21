import type { ViewSettings } from 'codemirror-lang-veldt-deck';
import { TagManualPredicate, type ViewTag } from '$lib/editor/tags.svelte';

export interface VirtualView {
	object: 'virtual-view';
	label: string;
	settings: ViewSettings;
	tags: ViewTag[];
}

export const PRESET_VIEWS: Record<string, VirtualView> = {
	types: {
		object: 'virtual-view',
		label: 'types',
		settings: {
			showUnmatched: false,
			showEmpty: false
		},
		tags: [
			new TagManualPredicate({ label: 'creatures' }, (card) => card.type_line.includes('Creature')),
			new TagManualPredicate({ label: 'instants' }, (card) => card.type_line.includes('Instant')),
			new TagManualPredicate({ label: 'sorceries' }, (card) => card.type_line.includes('Sorcery')),
			new TagManualPredicate(
				{ label: 'artifacts' },
				(card) => card.type_line.includes('Artifact') && !card.type_line.includes('Creature')
			),
			new TagManualPredicate(
				{ label: 'enchantments' },
				(card) => card.type_line.includes('Enchantment') && !card.type_line.includes('Creature')
			),
			new TagManualPredicate({ label: 'planeswalkers' }, (card) =>
				card.type_line.includes('Planeswalker')
			),
			new TagManualPredicate({ label: 'lands' }, (card) => card.type_line.includes('Land'))
		]
	},
	'no grouping': {
		object: 'virtual-view',
		label: 'no grouping',
		settings: {
			showUnmatched: false,
			showEmpty: false
		},
		tags: [
			new TagManualPredicate(
				{
					label: 'cards'
				},
				() => true
			)
		]
	}
};

export const DEFAULT_VIEW_ID = Object.keys(PRESET_VIEWS)[0];
