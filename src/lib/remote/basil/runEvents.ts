import { error } from '@sveltejs/kit';
import {
	BasilRunForbiddenError,
	BasilRunNotFoundError,
	type BasilRunEventRecord
} from '$lib/models/agent';
import type { Actor } from '$lib/models/household';

/** What the event stream reads a run through; `BasilController` is one. */
export interface BasilRunFeed {
	openRun(actor: Actor, runId: string): Promise<void>;
	listEvents(actor: Actor, runId: string, after: number): Promise<BasilRunEventRecord[]>;
	isStreamComplete(actor: Actor, runId: string, cursor: number): Promise<boolean>;
	watch(runId: string, listener: () => void): () => void;
}

export interface StreamTiming {
	/** Reads again this often in case a wake-up was missed. */
	pollMs: number;
	/** Sends a comment this often so proxies keep the connection open. */
	keepaliveMs: number;
}

const TIMING: StreamTiming = { pollMs: 5000, keepaliveMs: 15000 };
const encoder = new TextEncoder();

/** The cursor to send after: the `last-event-id` header, else `?after=`, else 0. */
function cursorAfter(request: Request, url: URL): number {
	const raw = request.headers.get('last-event-id') ?? url.searchParams.get('after') ?? '0';
	const cursor = Number(raw);
	if (!Number.isSafeInteger(cursor) || cursor < 0) error(400, 'Invalid event cursor');
	return cursor;
}

/**
 * A run's events as server-sent events. Replays from the cursor, then sends new events as the
 * bus wakes it (or the fallback poll finds them), and closes once the run has settled and every
 * event is sent.
 */
export async function basilEventsResponse(
	feed: BasilRunFeed,
	actor: Actor | null | undefined,
	runId: string,
	request: Request,
	url: URL,
	timing: StreamTiming = TIMING
): Promise<Response> {
	if (!actor) error(401, 'Sign in required');
	try {
		await feed.openRun(actor, runId);
	} catch (cause) {
		if (cause instanceof BasilRunNotFoundError) error(404, cause.message);
		if (cause instanceof BasilRunForbiddenError) error(403, cause.message);
		throw cause;
	}
	let cursor = cursorAfter(request, url);
	let teardown = () => {};

	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			let flushing = false;
			let again = false;

			const cleanup = () => {
				closed = true;
				clearInterval(poll);
				clearInterval(keepalive);
				unsubscribe();
			};
			teardown = cleanup;

			const close = () => {
				if (closed) return;
				cleanup();
				try {
					controller.close();
				} catch {
					// The client went away first; there is nobody left to tell.
				}
			};

			const send = (text: string): boolean => {
				try {
					controller.enqueue(encoder.encode(text));
					return true;
				} catch {
					// Enqueueing fails only once the client disconnected; stop producing.
					cleanup();
					return false;
				}
			};

			const flush = async () => {
				if (closed) return;
				if (flushing) {
					again = true;
					return;
				}
				flushing = true;
				try {
					do {
						again = false;
						for (const record of await feed.listEvents(actor, runId, cursor)) {
							if (closed) return;
							const frame = `id: ${record.cursor}\nevent: basil\ndata: ${JSON.stringify(record)}\n\n`;
							if (!send(frame)) return;
							cursor = record.cursor;
						}
						if (await feed.isStreamComplete(actor, runId, cursor)) {
							close();
							return;
						}
					} while (again && !closed);
				} catch (failure) {
					if (closed) return;
					cleanup();
					controller.error(failure);
				} finally {
					flushing = false;
				}
			};

			const unsubscribe = feed.watch(runId, () => void flush());
			const poll = setInterval(() => void flush(), timing.pollMs);
			const keepalive = setInterval(() => {
				if (!closed) send(': keepalive\n\n');
			}, timing.keepaliveMs);
			request.signal.addEventListener('abort', close);
			void flush();
		},
		cancel() {
			teardown();
		}
	});

	return new Response(body, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
}
