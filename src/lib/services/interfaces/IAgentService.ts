import type { Actor } from '$lib/models/household';
import type {
	AgentAction,
	AgentConversation,
	AgentRun,
	BasilConversationView,
	BasilTurnEvent
} from '$lib/models/agent';
import type { AgentToolbox } from '../agent/toolbox';

/** How one turn of Basil ended. */
export type BasilTurnOutcome =
	| { status: 'completed' }
	/** A change waits for a yes; the agent's state resumes the run once the person answers. */
	| { status: 'awaiting_approval'; serializedState: string }
	| { status: 'cancelled' }
	| { status: 'failed'; message: string; retryable: boolean };

export interface BasilTurnInput {
	actor: Actor;
	toolbox: AgentToolbox;
	/** The claimed run: a new message, or, with its serialized state, a run resuming after a decision. */
	run: AgentRun;
	now: Date;
	/** Aborts when the person taps Stop. */
	signal: AbortSignal;
}

/** Basil's conversations and the agent that answers them. */
export interface IAgentService {
	/** The member's latest conversation, or null before they ever asked. */
	latestConversation(actor: Actor): Promise<AgentConversation | null>;
	/** The member's latest conversation, started when there is none. */
	conversationFor(actor: Actor, now: Date): Promise<AgentConversation>;
	/** A new, empty conversation. */
	startOver(actor: Actor, now: Date): Promise<AgentConversation>;
	/** The conversation as the sheet shows it, without its run. */
	view(conversationId: string): Promise<Omit<BasilConversationView, 'activeRun'>>;
	/**
	 * The member's change still waiting for a yes; null once it was decided. Throws "not found"
	 * for another member's action.
	 */
	pendingAction(actor: Actor, actionId: string): Promise<AgentAction | null>;
	/** Records yes or not now; false when another tap or tab decided it first. */
	decide(actionId: string, approve: boolean, now: Date): Promise<boolean>;
	/**
	 * Declines the change a parked run waits on, because the person sent a new message instead:
	 * the SDK rejects the pending call, so the model reads that nothing changed.
	 */
	declineWaiting(input: { toolbox: AgentToolbox; run: AgentRun; now: Date }): Promise<void>;
	/** Adds Basil's words to the conversation, outside a turn. */
	say(conversationId: string, text: string, now: Date): Promise<void>;
	/**
	 * One turn: the agent answers until it replies in words, asks for a yes, runs out of turns,
	 * or is stopped. Yields what the sheet shows as it happens; never throws.
	 */
	turn(input: BasilTurnInput): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome>;
}
