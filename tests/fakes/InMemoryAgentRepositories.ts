import { v4 as uuid } from 'uuid';
import type {
	AgentAction,
	AgentActionDecision,
	AgentActionStatus,
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
} from '../../src/lib/models/agent';
import { ACTIVE_RUN_STATUSES, BasilBusyError } from '../../src/lib/models/agent';
import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository,
	IAgentRunRepository,
	IAgentSessionRepository
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

export class InMemoryAgentSessionRepository implements IAgentSessionRepository {
	readonly items = new Map<string, AgentSessionItem[]>();

	async list(conversationId: string): Promise<AgentSessionItem[]> {
		return structuredClone(this.items.get(conversationId) ?? []);
	}

	async replace(conversationId: string, items: readonly AgentSessionItem[]): Promise<void> {
		this.items.set(conversationId, structuredClone([...items]));
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

	async findByCall(conversationId: string, callId: string): Promise<AgentAction | null> {
		const action = this.actions.find(
			(a) => a.conversationId === conversationId && a.callId === callId
		);
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

/** Runs and their events in memory, with the two unique rules of the real tables. */
export class InMemoryAgentRunRepository implements IAgentRunRepository {
	readonly runs: AgentRun[] = [];
	readonly events: BasilRunEventRecord[] = [];
	private nextCursor = 1;

	constructor(private messages: InMemoryAgentMessageRepository) {}

	async submit(
		run: NewAgentRun,
		userMessage: AgentMessageBody,
		at: Date
	): Promise<{ run: AgentRun; created: boolean; cursor: number }> {
		const existing = await this.findByRequest(run.userId, run.requestId);
		if (existing) {
			return { run: existing, created: false, cursor: await this.latestCursor(existing.id) };
		}
		if (await this.findActive(run.conversationId)) throw new BasilBusyError();
		const stored: AgentRun = {
			...structuredClone(run),
			id: uuid(),
			status: 'queued',
			serializedState: null,
			failure: null,
			cancelRequestedAt: null,
			createdAt: at,
			finishedAt: null
		};
		this.runs.push(stored);
		await this.messages.append(run.conversationId, userMessage, at);
		const record = await this.appendEvent(stored.id, { type: 'run_queued' });
		return { run: { ...stored }, created: true, cursor: record.cursor };
	}

	async findById(id: string): Promise<AgentRun | null> {
		const run = this.runs.find((r) => r.id === id);
		return run ? { ...run } : null;
	}

	async findByRequest(userId: string, requestId: string): Promise<AgentRun | null> {
		const run = this.runs.find((r) => r.userId === userId && r.requestId === requestId);
		return run ? { ...run } : null;
	}

	async findActive(conversationId: string): Promise<AgentRun | null> {
		const run = this.runs.find(
			(r) =>
				r.conversationId === conversationId &&
				(ACTIVE_RUN_STATUSES as readonly AgentRunStatus[]).includes(r.status)
		);
		return run ? { ...run } : null;
	}

	async findParked(conversationId: string): Promise<AgentRun | null> {
		const run = this.runs.findLast(
			(r) => r.conversationId === conversationId && r.status === 'awaiting_approval'
		);
		return run ? { ...run } : null;
	}

	async listByStatus(statuses: readonly AgentRunStatus[]): Promise<AgentRun[]> {
		return this.runs.filter((r) => statuses.includes(r.status)).map((r) => ({ ...r }));
	}

	async transition(
		id: string,
		from: readonly AgentRunStatus[],
		to: AgentRunTransition,
		event: BasilEvent | null
	): Promise<AgentRun | null> {
		const run = this.runs.find((r) => r.id === id);
		if (!run || !from.includes(run.status)) return null;
		run.status = to.status;
		if (to.serializedState !== undefined) run.serializedState = to.serializedState;
		if (to.failure !== undefined) run.failure = to.failure;
		if (to.cancelRequestedAt) run.cancelRequestedAt = to.cancelRequestedAt;
		if (to.finishedAt) run.finishedAt = to.finishedAt;
		if (event) await this.appendEvent(id, event);
		return { ...run };
	}

	async appendEvent(runId: string, event: BasilEvent): Promise<BasilRunEventRecord> {
		const record = { runId, cursor: this.nextCursor++, event: structuredClone(event) };
		this.events.push(record);
		return record;
	}

	async listEvents(runId: string, after: number): Promise<BasilRunEventRecord[]> {
		return this.events.filter((e) => e.runId === runId && e.cursor > after);
	}

	async latestCursor(runId: string): Promise<number> {
		return this.events.filter((e) => e.runId === runId).at(-1)?.cursor ?? 0;
	}

	/** The run's events, without cursors. */
	eventsOf(runId: string): BasilEvent[] {
		return this.events.filter((e) => e.runId === runId).map((e) => e.event);
	}
}
