import type { Actor } from '$lib/models/household';
import type {
	AgentConversation,
	BasilConversationView,
	BasilDoor,
	BasilRunRequest,
	BasilTurnEvent
} from '$lib/models/agent';
import type { AgentToolbox } from '../agent/toolbox';

/** How one turn of Basil's loop ended. */
export type BasilTurnOutcome =
	| { status: 'completed' }
	| { status: 'awaiting_approval' }
	| { status: 'cancelled' }
	| { status: 'failed'; message: string; retryable: boolean };

export interface BasilTurnInput {
	actor: Actor;
	toolbox: AgentToolbox;
	conversationId: string;
	request: BasilRunRequest;
	now: Date;
	/** Aborts when the person taps Stop. */
	signal: AbortSignal;
}

/** What deciding on a change did. */
export interface BasilDecision {
	conversationId: string;
	/** False when another tap or tab decided it first; nothing ran. */
	decided: boolean;
	/** Doors whose data the approved change made stale. */
	staleDoors: BasilDoor[];
}

/** Basil's conversations and the loop that answers them. */
export interface IAgentService {
	/** The member's latest conversation, or null before they ever asked. */
	latestConversation(actor: Actor): Promise<AgentConversation | null>;
	/** The member's latest conversation, started when there is none. */
	conversationFor(actor: Actor, now: Date): Promise<AgentConversation>;
	/** A new, empty conversation. A change still waiting in the old one is dropped. */
	startOver(actor: Actor, now: Date): Promise<AgentConversation>;
	/** The conversation as the sheet shows it, without its run. */
	view(conversationId: string): Promise<Omit<BasilConversationView, 'activeRun'>>;
	/** Drops a change still waiting for a yes: the person sent a new message instead. */
	dropPending(conversationId: string, now: Date): Promise<void>;
	/**
	 * Yes runs the waiting change; not now runs nothing. Either way the model reads the outcome
	 * on the next turn. Throws "not found" for another member's action.
	 */
	decide(
		actor: Actor,
		toolbox: AgentToolbox,
		input: { actionId: string; approve: boolean; now: Date }
	): Promise<BasilDecision>;
	/** Adds Basil's words to the conversation, outside a turn. */
	say(conversationId: string, text: string, now: Date): Promise<void>;
	/**
	 * One turn: calls the model until it answers in words, asks for a yes, runs out of steps, or
	 * is stopped. Yields what the sheet shows as it happens; never throws.
	 */
	turn(input: BasilTurnInput): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome>;
}
