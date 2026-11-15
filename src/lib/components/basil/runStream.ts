/**
 * Follows one of Basil's runs over server-sent events. Frames are handled one at a time and in
 * order, a cursor already handled is dropped, and a dropped connection reconnects from the last
 * handled cursor. The run and its cursor are remembered for the tab, so a reload follows the
 * same run again.
 */

import { basilRunEventRecordSchema, type BasilRunEventRecord } from '$lib/models/agent';

export interface RunEventSource {
	close(): void;
}

export type OpenRunEventSource = (input: {
	url: string;
	onFrame(data: string): void;
	onError(): void;
}) => RunEventSource;

/** Where the tab remembers the run it follows. */
export interface RunMemory {
	load(): { runId: string; cursor: number } | null;
	save(value: { runId: string; cursor: number }): void;
	clear(): void;
}

export interface RunStreamInput {
	runId: string;
	/** Frames at or before this cursor are not sent again. */
	after: number;
	/**
	 * Events up to this cursor were already applied before a reload: they are sent again so the
	 * sheet can rebuild Basil's words, marked `replayed` so steps for the browser do not run twice.
	 */
	appliedUpTo?: number;
	onEvent(record: BasilRunEventRecord, replayed: boolean): void | Promise<void>;
	/** The connection dropped; the stream reconnects by itself. */
	onError?(): void;
}

/** Events after which a run sends nothing more. */
const LAST_EVENTS = new Set(['completed', 'failed', 'cancelled', 'approval_required']);

export const RECONNECT_MS = 3000;

const openBrowserSource: OpenRunEventSource = (input) => {
	const source = new EventSource(input.url);
	source.addEventListener('basil', (event) => input.onFrame((event as MessageEvent<string>).data));
	source.onerror = input.onError;
	return source;
};

const MEMORY_KEY = 'basil:run';

/** The tab's sessionStorage. */
export const sessionRunMemory: RunMemory = {
	load() {
		try {
			const value: unknown = JSON.parse(sessionStorage.getItem(MEMORY_KEY) ?? 'null');
			if (
				typeof value === 'object' &&
				value !== null &&
				typeof (value as { runId?: unknown }).runId === 'string' &&
				typeof (value as { cursor?: unknown }).cursor === 'number'
			) {
				return value as { runId: string; cursor: number };
			}
			return null;
		} catch {
			// Unreadable memory is the same as none: the sheet starts from the conversation.
			return null;
		}
	},
	save(value) {
		sessionStorage.setItem(MEMORY_KEY, JSON.stringify(value));
	},
	clear() {
		sessionStorage.removeItem(MEMORY_KEY);
	}
};

export class RunStream {
	private source?: RunEventSource;
	private cursor: number;
	private closed = false;
	/** Each connection's frames are ignored once a newer connection replaced it. */
	private generation = 0;
	private queue: Promise<void> = Promise.resolve();
	private retry?: ReturnType<typeof setTimeout>;
	private applied: number;

	constructor(
		private readonly input: RunStreamInput,
		private readonly open: OpenRunEventSource = openBrowserSource,
		private readonly memory: RunMemory | null = null,
		private readonly reconnectMs = RECONNECT_MS
	) {
		this.cursor = input.after;
		this.applied = Math.max(input.after, input.appliedUpTo ?? 0);
		this.memory?.save({ runId: input.runId, cursor: this.applied });
		this.connect();
	}

	/** The last cursor handled. */
	get handled(): number {
		return this.cursor;
	}

	close(): void {
		this.closed = true;
		this.generation += 1;
		this.source?.close();
		clearTimeout(this.retry);
	}

	private connect(): void {
		const generation = ++this.generation;
		this.source = this.open({
			url: `/api/basil/runs/${encodeURIComponent(this.input.runId)}/events?after=${this.cursor}`,
			onError: () => this.reconnect(generation),
			onFrame: (data) => {
				this.queue = this.queue.then(() => this.consume(generation, data));
			}
		});
	}

	private async consume(generation: number, data: string): Promise<void> {
		if (this.closed || generation !== this.generation) return;
		let record: BasilRunEventRecord;
		try {
			record = basilRunEventRecordSchema.parse(JSON.parse(data));
		} catch {
			// A frame we cannot read: start again from the last one we could.
			this.reconnect(generation);
			return;
		}
		if (record.runId !== this.input.runId || record.cursor <= this.cursor) return;
		try {
			await this.input.onEvent(record, record.cursor <= this.applied);
		} catch {
			// The sheet could not apply it: reconnect, and the event is sent again.
			this.reconnect(generation);
			return;
		}
		this.cursor = record.cursor;
		if (LAST_EVENTS.has(record.event.type)) {
			this.memory?.clear();
			this.close();
			return;
		}
		this.applied = Math.max(this.applied, this.cursor);
		this.memory?.save({ runId: this.input.runId, cursor: this.applied });
	}

	private reconnect(generation: number): void {
		if (this.closed || generation !== this.generation) return;
		this.generation += 1;
		this.source?.close();
		this.input.onError?.();
		this.retry = setTimeout(() => {
			if (!this.closed) this.connect();
		}, this.reconnectMs);
	}
}
