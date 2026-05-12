import { getAuth } from '@card-confluence/auth';
import { db } from './db';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$env/static/private';

export const auth = getAuth(db, {
	secret: BETTER_AUTH_SECRET,
	baseURL: BETTER_AUTH_URL
});
