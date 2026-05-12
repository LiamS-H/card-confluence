import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export const handle = async ({ event, resolve }) => {
	event.locals.auth = auth;
	event.locals.db = db;

	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.user = session.user;
		event.locals.session = session.session;
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
