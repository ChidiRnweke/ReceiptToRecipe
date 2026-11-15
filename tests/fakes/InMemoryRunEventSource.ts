import type { OpenRunEventSource, RunMemory } from '../../src/lib/components/basil/runStream';
import type { BasilRunEventRecord } from '../../src/lib/models/agent';

interface Connection {
	url: string;
	closed: boolean;
	onFrame(data: string): void;
	onError(): void;
}

/** An event source the test drives: every connection is recorded, frames go to the latest. */
export class InMemoryRunEventSource {
	readonly connections: Connection[] = [];

	readonly open: OpenRunEventSource = (input) => {
		const connection: Connection = { ...input, closed: false };
		this.connections.push(connection);
		return {
			close: () => {
				connection.closed = true;
			}
		};
	};

	private get current(): Connection {
		const connection = this.connections.at(-1);
		if (!connection) throw new Error('Nothing is connected');
		return connection;
	}

	emit(record: BasilRunEventRecord): void {
		this.current.onFrame(JSON.stringify(record));
	}

	emitRaw(data: string): void {
		this.current.onFrame(data);
	}

	drop(): void {
		this.current.onError();
	}
}

export class InMemoryRunMemory implements RunMemory {
	value: { runId: string; cursor: number } | null = null;
	load() {
		return this.value;
	}
	save(value: { runId: string; cursor: number }) {
		this.value = value;
	}
	clear() {
		this.value = null;
	}
}
