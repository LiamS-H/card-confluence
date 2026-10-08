// 1. Define a helper type for partial nested objects
export type DeepPartial<T> = {
	[P in keyof T]?: DeepPartial<T[P]>;
};

export function deepAssign(target: any, source: any) {
	for (const key in source) {
		if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
			if (!target[key]) target[key] = {};
			deepAssign(target[key], source[key]);
		} else {
			target[key] = source[key]; // This precise assignment triggers fine-grained reactivity
		}
	}
}
