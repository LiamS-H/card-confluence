import type { Auth } from "@card-confluence/auth";
import { db } from "$lib/server/db";

declare global {
	namespace App {
		interface Locals {
			auth: Auth;
			db: typeof db;
			user: Auth["$InferServer"]["session"]["user"] | null;
			session: Auth["$InferServer"]["session"]["session"] | null;
		}
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
