import type { Action } from 'svelte/action';

export const autoFocus: Action<HTMLElement, boolean | undefined> = (node, shouldFocus = true) => {
	const previouslyFocused = document.activeElement as HTMLElement | null;

	if (shouldFocus) {
		const target = (node.querySelector('[autofocus]') as HTMLElement) || node;
		target.focus();
	}

	return {
		destroy() {
			if (shouldFocus) {
				previouslyFocused?.focus();
			}
		}
	};
};
