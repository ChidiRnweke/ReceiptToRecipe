import { v4 as uuid } from 'uuid';
import type {
	AgentAction,
	AgentActionDecision,
	AgentActionStatus,
	AgentConversation,
	AgentMessage,
	AgentMessageBody,
	NewAgentAction
} from '../../src/lib/models/agent';
import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository
} from '../../src/lib/repositories/interfaces/IAgentRepositories';

export class InMemoryAgentConversationRepository implements IAgentConversationRepository {
	readonly conversations: AgentConversation[] = [];

	async findLatest(householdId: string, userId: string): Promise<AgentConversation | null> {
		const mine = this.conversations.filter(
			(c) => c.householdId === householdId && c.userId === userId
		);
		return mine.at(-1) ?? null;
	}

	async findById(id: string): Promise<AgentConversation | null> {
		return this.conversations.find((c) => c.id === id) ?? null;
	}

	async create(householdId: string, userId: string, at: Date): Promise<AgentConversation> {
		const conversation = { id: uuid(), householdId, userId, createdAt: at };
		this.conversations.push(conversation);
		return conversation;
	}
}

export class InMemoryAgentMessageRepository implements IAgentMessageRepository {
	readonly messages: AgentMessage[] = [];

	async append(conversationId: string, body: AgentMessageBody, at: Date): Promise<AgentMessage> {
		const message = { ...structuredClone(body), id: uuid(), conversationId, createdAt: at };
		this.messages.push(message);
		return message;
	}

	async list(conversationId: string): Promise<AgentMessage[]> {
		return this.messages.filter((m) => m.conversationId === conversationId).map((m) => ({ ...m }));
	}
}

export class InMemoryAgentActionRepository implements IAgentActionRepository {
	readonly actions: AgentAction[] = [];

	async create(action: NewAgentAction, at: Date): Promise<AgentAction> {
		const stored: AgentAction = {
			...action,
			args: structuredClone(action.args),
			id: uuid(),
			status: 'pending',
			result: null,
			touched: [],
			createdAt: at,
			decidedAt: null
		};
		this.actions.push(stored);
		return { ...stored };
	}

	async findById(id: string): Promise<AgentAction | null> {
		const action = this.actions.find((a) => a.id === id);
		return action ? { ...action } : null;
	}

	async list(conversationId: string): Promise<AgentAction[]> {
		return this.actions.filter((a) => a.conversationId === conversationId).map((a) => ({ ...a }));
	}

	async decide(
		id: string,
		from: AgentActionStatus,
		decision: AgentActionDecision
	): Promise<AgentAction | null> {
		const action = this.actions.find((a) => a.id === id);
		if (!action || action.status !== from) return null;
		action.status = decision.status;
		action.result = decision.result ?? null;
		action.touched = decision.touched ?? [];
		action.decidedAt = decision.decidedAt;
		return { ...action };
	}
}
