import type {
	AgentAction,
	AgentActionDecision,
	AgentConversation,
	AgentMessage,
	AgentMessageBody,
	NewAgentAction
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

/** The changes Basil proposed, and what the person decided. */
export interface IAgentActionRepository {
	create(action: NewAgentAction, at: Date): Promise<AgentAction>;
	findById(id: string): Promise<AgentAction | null>;
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
