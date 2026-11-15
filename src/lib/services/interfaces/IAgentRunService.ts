import type { Actor } from '$lib/models/household';
import type {
	AgentRun,
	BasilActiveRun,
	BasilRunEventRecord,
	BasilRunInput,
	BasilTurnEvent
} from '$lib/models/agent';
import type { BasilTurnOutcome } from './IAgentService';

/** Runs one turn of Basil for a claimed run; the controller supplies it. */
export type BasilTurnRunner = (
	run: AgentRun,
	signal: AbortSignal
) => AsyncGenerator<BasilTurnEvent, BasilTurnOutcome>;

export interface SubmitRun {
	conversationId: string;
	requestId: string;
	input: BasilRunInput;
	/** The person's message, stored with the run; null for a decision. */
	userMessage: string | null;
}

/** The life of Basil's runs: start, execute in the background, stop, recover, replay. */
export interface IAgentRunService {
	findByRequest(actor: Actor, requestId: string): Promise<AgentRun | null>;
	/** The conversation's active run with the cursor its stream has reached, if any. */
	activeRun(conversationId: string): Promise<BasilActiveRun | null>;
	/**
	 * Stores the run with the person's message and `run_queued`. A request id used before returns
	 * its run. Throws `BasilBusyError` while another run is active in the conversation.
	 */
	submit(
		actor: Actor,
		input: SubmitRun,
		now: Date
	): Promise<{ run: AgentRun; created: boolean; cursor: number }>;
	/** Executes the run in the background: claims it, streams its events, settles it. */
	launch(run: AgentRun, runner: BasilTurnRunner): void;
	/**
	 * A queued run is cancelled at once. A running one is stopped: it keeps what Basil had said,
	 * and is settled after a grace period if it does not stop by itself.
	 */
	cancel(actor: Actor, runId: string, now: Date): Promise<AgentRun>;
	/** Throws `BasilRunNotFoundError`, or `BasilRunForbiddenError` for another member's run. */
	getRun(actor: Actor, runId: string): Promise<AgentRun>;
	listEvents(actor: Actor, runId: string, after: number): Promise<BasilRunEventRecord[]>;
	/** True once the run has settled and `cursor` has reached its last event. */
	isStreamComplete(actor: Actor, runId: string, cursor: number): Promise<boolean>;
	/** Calls the listener when the run has new events. Returns the unsubscribe. */
	subscribe(runId: string, listener: () => void): () => void;
	/**
	 * After a restart: runs that were running fail as interrupted, runs being stopped are
	 * cancelled, and queued runs are returned to launch again.
	 */
	recover(now: Date): Promise<{ interrupted: AgentRun[]; queued: AgentRun[] }>;
}
