import { describe, it, expect, afterEach } from 'vitest';
import { RunStream } from '../../../src/lib/components/basil/runStream';
import type { BasilEvent, BasilRunEventRecord } from '../../../src/lib/models/agent';
import { InMemoryRunEventSource, InMemoryRunMemory } from '../../fakes/InMemoryRunEventSource';

const RUN = 'run-1';
const record = (cursor: number, event: BasilEvent = { type: 'text_delta', text: `${cursor}` }) => ({
	runId: RUN,
	cursor,
	event
});
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('RunStream', () => {
	let stream: RunStream | null = null;
	afterEach(() => stream?.close());

	function follow(
		onEvent: (record: BasilRunEventRecord, replayed: boolean) => void | Promise<void> = () => {},
		options: { after?: number; appliedUpTo?: number; memory?: InMemoryRunMemory } = {}
	) {
		const source = new InMemoryRunEventSource();
		stream = new RunStream(
			{ runId: RUN, after: options.after ?? 0, appliedUpTo: options.appliedUpTo, onEvent },
			source.open,
			options.memory ?? null,
			10
		);
		return source;
	}

	it('connects from the cursor it was given', () => {
		const source = follow(() => {}, { after: 4 });
		expect(source.connections[0].url).toBe('/api/basil/runs/run-1/events?after=4');
	});

	it('hands events over in order, one at a time', async () => {
		const seen: number[] = [];
		let release!: () => void;
		const gate = new Promise<void>((done) => (release = done));
		const source = follow(async (r) => {
			if (r.cursor === 1) await gate;
			seen.push(r.cursor);
		});
		source.emit(record(1));
		source.emit(record(2));
		release();
		await settle();
		expect(seen).toEqual([1, 2]);
	});

	it('drops a cursor it has already handled', async () => {
		const seen: number[] = [];
		const source = follow((r) => {
			seen.push(r.cursor);
		});
		source.emit(record(1));
		source.emit(record(1));
		source.emit(record(2));
		await settle();
		expect(seen).toEqual([1, 2]);
	});

	it('reconnects from the last handled cursor after the connection drops', async () => {
		const source = follow();
		source.emit(record(1));
		source.emit(record(2));
		await settle();
		source.drop();
		await new Promise((done) => setTimeout(done, 20));
		expect(source.connections.at(-1)?.url).toBe('/api/basil/runs/run-1/events?after=2');
	});

	it('reconnects from before an event the sheet could not apply', async () => {
		const source = follow((r) => {
			if (r.cursor === 2) throw new Error('could not apply');
		});
		source.emit(record(1));
		source.emit(record(2));
		await new Promise((done) => setTimeout(done, 20));
		expect(source.connections.at(-1)?.url).toBe('/api/basil/runs/run-1/events?after=1');
	});

	it('marks events up to the applied cursor as replayed', async () => {
		const replayed: boolean[] = [];
		const source = follow(
			(_, again) => {
				replayed.push(again);
			},
			{ appliedUpTo: 1 }
		);
		source.emit(record(1));
		source.emit(record(2));
		await settle();
		expect(replayed).toEqual([true, false]);
	});

	it('remembers the run and its cursor for the tab', async () => {
		const memory = new InMemoryRunMemory();
		const source = follow(() => {}, { memory });
		source.emit(record(3));
		await settle();
		expect(memory.value).toEqual({ runId: RUN, cursor: 3 });
	});

	it('keeps the applied cursor in memory while replaying earlier events', async () => {
		const memory = new InMemoryRunMemory();
		const source = follow(() => {}, { memory, appliedUpTo: 5 });
		source.emit(record(2));
		await settle();
		expect(memory.value?.cursor).toBe(5);
	});

	it('forgets the run once it has ended', async () => {
		const memory = new InMemoryRunMemory();
		const source = follow(() => {}, { memory });
		source.emit(record(1, { type: 'completed' }));
		await settle();
		expect(memory.value).toBeNull();
	});

	it('closes its connection once the run has ended', async () => {
		const source = follow();
		source.emit(record(1, { type: 'approval_required', action: { id: 'a', summary: 'x' } }));
		await settle();
		expect(source.connections[0].closed).toBe(true);
	});

	it('ignores frames after it was closed', async () => {
		const seen: number[] = [];
		const source = follow((r) => {
			seen.push(r.cursor);
		});
		stream?.close();
		source.emit(record(1));
		await settle();
		expect(seen).toEqual([]);
	});
});
