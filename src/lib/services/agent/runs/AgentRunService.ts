import type { IAgentRunRepository } from '$repositories';
import type { Actor } from '$lib/models/household';
import {
	BasilRunForbiddenError,
	BasilRunNotFoundError,
	RESTARTED_REPLY,
	SETTLED_RUN_STATUSES,
	type AgentRun,
	type AgentRunStatus,
	type BasilActiveRun,
	type BasilEvent,
	type BasilRunEventRecord
} from '$lib/models/agent';
import type {
	BasilTurnRunner,
	IAgentRunService,
	SubmitRun
} from '../../interfaces/IAgentRunService';
import type { BasilTurnOutcome } from '../../interfaces/IAgentService';
import type { IRunEventBus } from './RunEventBus';
import type { ActiveRuns } from './ActiveRuns';
import { DeltaWriter } from './DeltaWriter';

/** Words are written to the stream at most this often. */
export const DELTA_FLUSH_MS = 120;
/** A stopped run that has not wound down by itself is settled after this long. */
export const CANCEL_GRACE_MS = 5000;

/** Why a run failed when its execution itself broke. */
export const STOPPED_UNEXPECTEDLY = 'Basil stopped unexpectedly. Try again in a moment.';

export interface AgentRunServiceOptions {
	flushMs?: number;
	graceMs?: number;
	clock?: () => Date;
}

/**
 * Basil's runs. Postgres holds the truth: the run row and its events, each with a cursor. The
 * bus only says that a run has new events; the stream reads them from its cursor.
 */
export class AgentRunService implements IAgentRunService {
	private readonly flushMs: number;
	private readonly graceMs: number;
	private readonly clock: () => Date;

	constructor(
		private runs: IAgentRunRepository,
		private bus: IRunEventBus,
		private active: ActiveRuns,
		options: AgentRunServiceOptions = {}
	) {
		this.flushMs = options.flushMs ?? DELTA_FLUSH_MS;
		this.graceMs = options.graceMs ?? CANCEL_GRACE_MS;
		this.clock = options.clock ?? (() => new Date());
	}

	findByRequest(actor: Actor, requestId: string): Promise<AgentRun | null> {
		return this.runs.findByRequest(actor.userId, requestId);
	}

	async activeRun(conversationId: string): Promise<BasilActiveRun | null> {
		const run = await this.runs.findActive(conversationId);
		if (!run) return null;
		return { id: run.id, cursor: await this.runs.latestCursor(run.id) };
	}

	async submit(
		actor: Actor,
		input: SubmitRun,
		now: Date
	): Promise<{ run: AgentRun; created: boolean; cursor: number }> {
		const submitted = await this.runs.submit(
			{
				conversationId: input.conversationId,
				householdId: actor.householdId,
				userId: actor.userId,
				requestId: input.requestId,
				input: input.input
			},
			{ role: 'user', text: input.userMessage },
			now
		);
		if (submitted.created) this.bus.notify(submitted.run.id);
		return submitted;
	}

	parkedRun(conversationId: string): Promise<AgentRun | null> {
		return this.runs.findParked(conversationId);
	}

	async resume(runId: string, now: Date): Promise<{ run: AgentRun; cursor: number } | null> {
		const run = await this.runs.transition(
			runId,
			['awaiting_approval'],
			{ status: 'queued' },
			{ type: 'run_queued' },
			now
		);
		if (!run) return null;
		this.bus.notify(runId);
		return { run, cursor: await this.runs.latestCursor(runId) };
	}

	async close(runId: string, now: Date): Promise<AgentRun | null> {
		const parked = await this.runs.findById(runId);
		const closed = await this.runs.transition(
			runId,
			['awaiting_approval'],
			{ status: 'completed', serializedState: null, finishedAt: now },
			null,
			now
		);
		return closed && parked;
	}

	launch(run: AgentRun, runner: BasilTurnRunner): void {
		const controller = this.active.register(run.id);
		const done = this.execute(run.id, runner, controller.signal)
			.catch((error) => this.fail(run.id, error))
			.catch((error) => console.error(`[basil] could not settle run ${run.id}`, error))
			.finally(() => this.active.release(run.id, controller));
		this.active.track(run.id, controller, done);
	}

	/** Resolves once every run executing in this process has ended. For tests and shutdown. */
	idle(): Promise<void> {
		return this.active.idle();
	}

	async cancel(actor: Actor, runId: string, now: Date): Promise<AgentRun> {
		const run = await this.getRun(actor, runId);
		if (run.status === 'queued') {
			const cancelled = await this.runs.transition(
				runId,
				['queued'],
				{ status: 'cancelled', cancelRequestedAt: now, finishedAt: now },
				{ type: 'cancelled' },
				now
			);
			if (cancelled) {
				this.bus.notify(runId);
				return cancelled;
			}
		}
		const stopping = await this.runs.transition(
			runId,
			['running'],
			{ status: 'cancelling', cancelRequestedAt: now },
			null,
			now
		);
		if (!stopping) return (await this.runs.findById(runId)) ?? run;
		this.bus.notify(runId);
		if (this.active.abort(runId)) {
			const timer = setTimeout(() => {
				this.finishCancellation(runId).catch((error) =>
					console.error(`[basil] could not settle stopped run ${runId}`, error)
				);
			}, this.graceMs);
			timer.unref?.();
			return stopping;
		}
		// Started by a process that is gone: nothing here can wind it down.
		return (await this.finishCancellation(runId)) ?? stopping;
	}

	async getRun(actor: Actor, runId: string): Promise<AgentRun> {
		const run = await this.runs.findById(runId);
		if (!run) throw new BasilRunNotFoundError();
		if (run.userId !== actor.userId || run.householdId !== actor.householdId) {
			throw new BasilRunForbiddenError();
		}
		return run;
	}

	async listEvents(actor: Actor, runId: string, after: number): Promise<BasilRunEventRecord[]> {
		await this.getRun(actor, runId);
		return this.runs.listEvents(runId, after);
	}

	async isStreamComplete(actor: Actor, runId: string, cursor: number): Promise<boolean> {
		const run = await this.getRun(actor, runId);
		if (!isSettled(run.status)) return false;
		return cursor >= (await this.runs.latestCursor(runId));
	}

	subscribe(runId: string, listener: () => void): () => void {
		return this.bus.subscribe(runId, listener);
	}

	async recover(now: Date): Promise<{ interrupted: AgentRun[]; queued: AgentRun[] }> {
		const interrupted: AgentRun[] = [];
		for (const run of await this.runs.listByStatus(['running', 'cancelling'])) {
			if (run.status === 'cancelling') {
				await this.finishCancellation(run.id);
				continue;
			}
			const failed = await this.runs.transition(
				run.id,
				['running'],
				{ status: 'failed', failure: 'restarted', finishedAt: now },
				{ type: 'failed', message: RESTARTED_REPLY, retryable: true },
				now
			);
			if (failed) {
				interrupted.push(failed);
				this.bus.notify(run.id);
			}
		}
		return { interrupted, queued: await this.runs.listByStatus(['queued']) };
	}

	/** Claims the run, streams its turn into events, and settles it by how the turn ended. */
	private async execute(runId: string, runner: BasilTurnRunner, signal: AbortSignal) {
		const run = await this.runs.transition(
			runId,
			['queued'],
			{ status: 'running' },
			{ type: 'run_started' },
			this.clock()
		);
		// Cancelled while queued, or claimed by another launch.
		if (!run) return;
		this.bus.notify(runId);

		const writer = new DeltaWriter(
			(text) => this.append(runId, { type: 'text_delta', text }),
			this.flushMs
		);
		const turn = runner(run, signal);
		let outcome: BasilTurnOutcome;
		try {
			for (;;) {
				const step = await turn.next();
				if (step.done) {
					outcome = step.value;
					break;
				}
				if (step.value.type === 'text_delta') {
					writer.push(step.value.text);
				} else {
					await writer.flush();
					await this.append(runId, step.value);
				}
			}
		} finally {
			await writer.flush();
		}
		await this.settle(runId, outcome);
	}

	private async settle(runId: string, outcome: BasilTurnOutcome): Promise<void> {
		const at = this.clock();
		if (outcome.status === 'cancelled') {
			await this.finishCancellation(runId, ['cancelling', 'running']);
			return;
		}
		if (outcome.status === 'failed') {
			await this.fail(runId, outcome.message, outcome.retryable);
			return;
		}
		const settled = await this.runs.transition(
			runId,
			['running'],
			outcome.status === 'awaiting_approval'
				? { status: outcome.status, serializedState: outcome.serializedState, finishedAt: at }
				: { status: outcome.status, serializedState: null, finishedAt: at },
			outcome.status === 'completed' ? { type: 'completed' } : null,
			at
		);
		// Stop was tapped as the turn ended: the stop wins.
		if (!settled) {
			await this.finishCancellation(runId);
			return;
		}
		this.bus.notify(runId);
	}

	private async finishCancellation(
		runId: string,
		from: readonly AgentRunStatus[] = ['cancelling']
	): Promise<AgentRun | null> {
		const at = this.clock();
		const cancelled = await this.runs.transition(
			runId,
			from,
			{ status: 'cancelled', finishedAt: at },
			{ type: 'cancelled' },
			at
		);
		if (cancelled) this.bus.notify(runId);
		return cancelled;
	}

	private async fail(runId: string, cause: unknown, retryable = false): Promise<void> {
		const message = typeof cause === 'string' ? cause : STOPPED_UNEXPECTEDLY;
		if (typeof cause !== 'string') console.error(`[basil] run ${runId} broke`, cause);
		const at = this.clock();
		const failed = await this.runs.transition(
			runId,
			['running', 'cancelling'],
			{ status: 'failed', failure: message, finishedAt: at },
			{ type: 'failed', message, retryable },
			at
		);
		if (failed) this.bus.notify(runId);
	}

	private async append(runId: string, event: BasilEvent): Promise<void> {
		await this.runs.appendEvent(runId, event, this.clock());
		this.bus.notify(runId);
	}
}

function isSettled(status: AgentRunStatus): boolean {
	return (SETTLED_RUN_STATUSES as readonly AgentRunStatus[]).includes(status);
}
