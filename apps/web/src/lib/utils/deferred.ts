/* eslint-disable @typescript-eslint/no-explicit-any */
export type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: any) => void;
};

export function createDeferred<T>(): Deferred<T> {
	return Promise.withResolvers<T>();
}
