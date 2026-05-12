import { DATABASE_URL } from '$env/static/private';
import { createDb } from '@repo/schema';

export const db = createDb(DATABASE_URL);
