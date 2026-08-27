import type { Action } from 'svelte/action';

export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	function handle(event: PointerEvent) {
		if (!node.contains(event.target as Node)) {
			callback();
		}
	}

	document.addEventListener('pointerdown', handle);

	return {
		destroy() {
			document.removeEventListener('pointerdown', handle);
		}
	};
};
