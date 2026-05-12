import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@card-confluence/schema";

export const getAuth = (db: any, options?: Partial<BetterAuthOptions>) =>
    betterAuth({
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
            },
        }),
        emailAndPassword: {
            enabled: true,
        },
        ...options,
    });

export type Auth = ReturnType<typeof getAuth>;
