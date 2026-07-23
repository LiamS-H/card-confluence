export class Channel<T> {
	private channel: BroadcastChannel;

	constructor(name: string) {
		this.channel = new BroadcastChannel(name);
	}

	postMessage(data: T): void {
		this.channel.postMessage(data);
	}

	onmessage(handler: (event: MessageEvent<T>) => void, controller?: AbortController): void {
		const options: AddEventListenerOptions = {};
		if (controller) options.signal = controller.signal;
		this.channel.addEventListener(
			'message',
			(event: Event) => {
				handler(event as MessageEvent<T>);
			},
			options
		);
	}

	close(): void {
		this.channel.close();
	}
}
