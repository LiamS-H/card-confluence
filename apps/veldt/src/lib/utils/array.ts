export interface RelativeIndexable<T> {
	readonly length: number;
	at(index: number): T | undefined;
	map<R>(callback: (i: T) => R): R[];
}
