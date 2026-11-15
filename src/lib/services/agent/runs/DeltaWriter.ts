/**
 * Coalesces Basil's words into one write every `flushMs`, instead of one per token. Writes go
 * out one at a time, in order.
 */
export class DeltaWriter {
	private buffer = '';
	private timer: ReturnType<typeof setTimeout> | undefined;
	private chain: Promise<void> = Promise.resolve();

	constructor(
		private readonly write: (text: string) => Promise<void>,
		private readonly flushMs: number
	) {}

	push(text: string): void {
		this.buffer += text;
		if (this.timer) return;
		this.timer = setTimeout(() => {
			// A failed write rejects the chain, and the run's next awaited flush throws it.
			this.flush().catch(() => undefined);
		}, this.flushMs);
	}

	/** Writes what is buffered, after every earlier write. Rejects when any write failed. */
	flush(): Promise<void> {
		clearTimeout(this.timer);
		this.timer = undefined;
		const text = this.buffer;
		this.buffer = '';
		if (text) this.chain = this.chain.then(() => this.write(text));
		return this.chain;
	}
}
