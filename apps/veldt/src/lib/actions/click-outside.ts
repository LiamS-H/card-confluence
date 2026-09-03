import type { Action } from 'svelte/action';

export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	const controller = new AbortController();

	document.addEventListener(
		'pointerdown',
		(event) => {
			if (!node.contains(event.target as Node)) {
				callback();
			}
		},
		{ signal: controller.signal }
	);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			callback();
		}
	});

	return {
		destroy() {
			controller.abort();
		}
	};
};
