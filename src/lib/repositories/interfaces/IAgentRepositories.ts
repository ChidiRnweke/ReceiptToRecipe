import type {
	AgentAction,
	AgentActionDecision,
	AgentConversation,
	AgentMessage,
	AgentMessageBody,
	AgentRun,
	AgentRunStatus,
	AgentRunTransition,
	AgentSessionItem,
	BasilEvent,
	BasilRunEventRecord,
	NewAgentAction,
	NewAgentRun
} from '$lib/models/agent';

/** Basil's conversations, one per member. */
export interface IAgentConversationRepository {
	/** The member's latest conversation, or null. */
	findLatest(householdId: string, userId: string): Promise<AgentConversation | null>;
	findById(id: string): Promise<AgentConversation | null>;
	create(householdId: string, userId: string, at: Date): Promise<AgentConversation>;
}

export interface IAgentMessageRepository {
	append(conversationId: string, body: AgentMessageBody, at: Date): Promise<AgentMessage>;
	/** Every message of the conversation, oldest first. */
	list(conversationId: string): Promise<AgentMessage[]>;
}

/** What Basil's agent reads back of a conversation, as agent SDK items. */
export interface IAgentSessionRepository {
	/** Every item of the conversation, in order. */
	list(conversationId: string): Promise<AgentSessionItem[]>;
	/** Replaces the conversation's items with these, in one transaction. */
	replace(conversationId: string, items: readonly AgentSessionItem[], at: Date): Promise<void>;
}

/** The changes Basil proposed, and what the person decided. */
export interface IAgentActionRepository {
	create(action: NewAgentAction, at: Date): Promise<AgentAction>;
	findById(id: string): Promise<AgentAction | null>;
	/** The action that answers the model's tool call, if Basil made one for it. */
	findByCall(conversationId: string, callId: string): Promise<AgentAction | null>;
	/** Every action of the conversation, oldest first. */
	list(conversationId: string): Promise<AgentAction[]>;
	/**
	 * Records a decision only while the action is still `pending` (or `approved`, for the outcome
	 * of an approval); returns null when another request decided it first.
	 */
	decide(
		id: string,
		from: AgentAction['status'],
		decision: AgentActionDecision
	): Promise<AgentAction | null>;
}

/** Basil's runs and the events each one streams. */
export interface IAgentRunRepository {
	/**
	 * In one transaction: the run, the person's message, and `run_queued`.
	 * A request id the member used before returns that run with `created: false`. Throws
	 * `BasilBusyError` when the conversation already has an active run.
	 */
	submit(
		run: NewAgentRun,
		userMessage: AgentMessageBody,
		at: Date
	): Promise<{ run: AgentRun; created: boolean; cursor: number }>;
	findById(id: string): Promise<AgentRun | null>;
	findByRequest(userId: string, requestId: string): Promise<AgentRun | null>;
	/** The conversation's queued, running or stopping run, if any. */
	findActive(conversationId: string): Promise<AgentRun | null>;
	/** The conversation's run waiting for a yes on a change, if any. */
	findParked(conversationId: string): Promise<AgentRun | null>;
	listByStatus(statuses: readonly AgentRunStatus[]): Promise<AgentRun[]>;
	/**
	 * Moves the run on only while it is in one of `from`, and appends `event` in the same
	 * transaction. Returns null when the run was elsewhere, so two writers cannot both settle it.
	 */
	transition(
		id: string,
		from: readonly AgentRunStatus[],
		to: AgentRunTransition,
		event: BasilEvent | null,
		at: Date
	): Promise<AgentRun | null>;
	appendEvent(runId: string, event: BasilEvent, at: Date): Promise<BasilRunEventRecord>;
	/** The run's events after a cursor, oldest first. */
	listEvents(runId: string, after: number): Promise<BasilRunEventRecord[]>;
	/** The run's last cursor; 0 when it has none. */
	latestCursor(runId: string): Promise<number>;
}
