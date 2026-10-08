import { page } from '$app/state';

export type HoveredCard = null | {
	card: Uint8Array;
	print?: Uint8Array;
};

let hovered_card: HoveredCard = $state(null);
let timeout: undefined | ReturnType<typeof setTimeout> = undefined;

export function get_hovered_card() {
	return {
		get hovered() {
			return hovered_card;
		}
	};
}

export function set_hovered_card(hover: HoveredCard) {
	hovered_card = hover;
	clearTimeout(timeout);
}

export function clear_hovered_card() {
	clearTimeout(timeout);
	timeout = setTimeout(() => {
		hovered_card = null;
	}, 100);
}

$effect.root(() => {
	$effect(() => {
		page.url;
		hovered_card = null;
	});
});
