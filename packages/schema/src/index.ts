import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as auth from "./auth";
import * as deck from "./deck";

export const schema = { ...auth, ...deck };

export function createDb(connectionString: string) {
    const sql = neon(connectionString);
    return drizzle({ client: sql, schema });
}

export * from "./auth";
export * from "./deck";
