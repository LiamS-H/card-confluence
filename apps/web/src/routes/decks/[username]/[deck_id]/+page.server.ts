import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	// TODO
	// deck was opened in non edit, this should fetch the view from postgres
	// deck for visibility / permissions
	// params.username;
	// params.deck_id;
	const deck_view = null;

	if (!params.deck_id) {
		throw error(404, 'Not found');
	}

	if (deck_view === null) {
		throw error(404, 'Not found');
	}

	return {
		deck_view
	};
};
