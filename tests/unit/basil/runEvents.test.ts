import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { basilEventsResponse, type BasilRunFeed } from '../../../src/lib/remote/basil/runEvents';
import {
	BasilRunForbiddenError,
	BasilRunNotFoundError,
	type BasilEvent,
	type BasilRunEventRecord
} from '../../../src/lib/models/agent';
import type { Actor } from '../../../src/lib/models/household';
import { actor } from '../../fakes/tonight';

const RUN = 'run-1';
const sam: Actor = { ...actor, userId: 'user-2' };

/** One run, owned by `actor`, whose events the test adds and settles. */
class FakeRunFeed implements BasilRunFeed {
	records: BasilRunEventRecord[] = [];
	settled = false;
	private listeners = new Set<() => void>();

	add(event: BasilEvent): void {
		this.records.push({ runId: RUN, cursor: this.records.length + 1, event });
	}
	notify(): void {
		for (const listener of this.listeners) listener();
	}
	async openRun(who: Actor, runId: string): Promise<void> {
		if (runId !== RUN) throw new BasilRunNotFoundError();
		if (who.userId !== actor.userId) throw new BasilRunForbiddenError();
	}
	async listEvents(_: Actor, __: string, after: number): Promise<BasilRunEventRecord[]> {
		return this.records.filter((record) => record.cursor > after);
	}
	async isStreamComplete(_: Actor, __: string, cursor: number): Promise<boolean> {
		return this.settled && cursor >= this.records.length;
	}
	watch(_: string, listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

const TIMING = { pollMs: 10_000, keepaliveMs: 10_000 };

function open(feed: FakeRunFeed, query = '', headers: Record<string, string> = {}, who = actor) {
	const url = new URL(`http://app.test/api/basil/runs/${RUN}/events${query}`);
	return basilEventsResponse(feed, who, RUN, new Request(url, { headers }), url, TIMING);
}

/** The ids of the frames a finished stream sent. */
async function idsOf(response: Response): Promise<number[]> {
	const text = await response.text();
	return [...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
}

function settledFeed(): FakeRunFeed {
	const feed = new FakeRunFeed();
	feed.add({ type: 'run_queued' });
	feed.add({ type: 'text_delta', text: 'Curry' });
	feed.add({ type: 'completed' });
	feed.settled = true;
	return feed;
}

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
	try {
		await promise;
		return null;
	} catch (error) {
		return isHttpError(error) ? error.status : null;
	}
}

describe('the Basil run event stream', () => {
	it('replays the events after the cursor', async () => {
		expect(await idsOf(await open(settledFeed(), '?after=1'))).toEqual([2, 3]);
	});

	it('prefers the Last-Event-ID header to the query', async () => {
		const response = await open(settledFeed(), '?after=0', { 'last-event-id': '2' });
		expect(await idsOf(response)).toEqual([3]);
	});

	it('closes once the run has settled and every event is sent', async () => {
		const text = await (await open(settledFeed())).text();
		expect(text.endsWith('\n\n')).toBe(true);
	});

	it('sends events that arrive while it is open', async () => {
		const feed = new FakeRunFeed();
		feed.add({ type: 'run_queued' });
		const response = await open(feed);
		const reading = idsOf(response);
		await new Promise((done) => setTimeout(done, 5));
		feed.add({ type: 'completed' });
		feed.settled = true;
		feed.notify();
		expect(await reading).toEqual([1, 2]);
	});

	it('turns buffering off for proxies', async () => {
		const response = await open(settledFeed());
		await response.text();
		expect(response.headers.get('x-accel-buffering')).toBe('no');
	});

	it('refuses another member with 403', async () => {
		expect(await statusOf(open(settledFeed(), '', {}, sam))).toBe(403);
	});

	it('answers an unknown run with 404', async () => {
		const url = new URL('http://app.test/api/basil/runs/nope/events');
		const response = basilEventsResponse(settledFeed(), actor, 'nope', new Request(url), url);
		expect(await statusOf(response)).toBe(404);
	});

	it('refuses a cursor that is not a number with 400', async () => {
		expect(await statusOf(open(settledFeed(), '?after=abc'))).toBe(400);
	});

	it('asks a signed-out visitor to sign in', async () => {
		const url = new URL(`http://app.test/api/basil/runs/${RUN}/events`);
		const response = basilEventsResponse(settledFeed(), null, RUN, new Request(url), url);
		expect(await statusOf(response)).toBe(401);
	});
});
