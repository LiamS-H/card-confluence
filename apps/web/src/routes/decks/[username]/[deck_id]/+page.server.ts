import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	// TODO
	// deck was opened in non edit, this should fetch the view from postgres
	// deck for visibility / permissions
	// params.username;
	// params.deck_id;
	const deck_view = null;

	if (!params.deck_id) {
		throw error(404, 'Not found 1');
	}

	if (deck_view === null) {
		throw error(404, 'Not found 2');
	}

	return {
		deck_view
	};
};
