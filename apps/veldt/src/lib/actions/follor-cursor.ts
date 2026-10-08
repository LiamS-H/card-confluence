import type { Action } from 'svelte/action';

// cursorAnchor.js
export const followCursor: Action<HTMLElement, number> = (node, offset = 10) => {
	node.style.position = 'fixed';
	node.style.pointerEvents = 'none';
	node.style.zIndex = '9999';

	const controller = new AbortController();

	window.addEventListener('mousemove', (event) => {
		const { width, height } = node.getBoundingClientRect();
		const { innerWidth, innerHeight } = window;

		let x = event.clientX + offset;
		let y = event.clientY + offset;

		if (x + width > innerWidth) {
			x = event.clientX - width - offset;
		}

		if (y + height > innerHeight) {
			y = event.clientY - height - offset;
		}

		node.style.left = `${x}px`;
		node.style.top = `${y}px`;
	});

	return {
		destroy() {
			controller.abort();
		}
	};
};
