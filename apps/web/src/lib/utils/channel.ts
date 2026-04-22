export class Channel<T> {
	private channel: BroadcastChannel;

	constructor(name: string) {
		this.channel = new BroadcastChannel(name);
	}

	postMessage(data: T): void {
		this.channel.postMessage(data);
	}

	onmessage(handler: (event: MessageEvent<T>) => void): void {
		this.channel.addEventListener('message', handler);
	}

	close(): void {
		this.channel.close();
	}
}
