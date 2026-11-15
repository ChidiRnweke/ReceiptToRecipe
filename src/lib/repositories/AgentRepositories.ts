import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type {
	AgentAction,
	AgentActionDecision,
	AgentActionStatus,
	AgentConversation,
	AgentMessage,
	AgentMessageBody,
	AgentToolCall,
	NewAgentAction,
	Touched
} from '$lib/models/agent';
import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository
} from './interfaces/IAgentRepositories';

const STATUSES: readonly AgentActionStatus[] = [
	'pending',
	'approved',
	'declined',
	'executed',
	'failed'
];

export class AgentConversationRepository implements IAgentConversationRepository {
	constructor(private db: Database) {}

	async findLatest(householdId: string, userId: string): Promise<AgentConversation | null> {
		const row = await this.db.query.agentConversations.findFirst({
			where: and(
				eq(schema.agentConversations.householdId, householdId),
				eq(schema.agentConversations.userId, userId)
			),
			orderBy: [desc(schema.agentConversations.createdAt)]
		});
		return row ?? null;
	}

	async findById(id: string): Promise<AgentConversation | null> {
		const row = await this.db.query.agentConversations.findFirst({
			where: eq(schema.agentConversations.id, id)
		});
		return row ?? null;
	}

	async create(householdId: string, userId: string, at: Date): Promise<AgentConversation> {
		const [row] = await this.db
			.insert(schema.agentConversations)
			.values({ householdId, userId, createdAt: at })
			.returning();
		return row;
	}
}

export class AgentMessageRepository implements IAgentMessageRepository {
	constructor(private db: Database) {}

	async append(conversationId: string, body: AgentMessageBody, at: Date): Promise<AgentMessage> {
		const { role, content, toolCalls } = toColumns(body);
		const [row] = await this.db
			.insert(schema.agentMessages)
			.values({ conversationId, role, content, toolCalls, createdAt: at })
			.returning();
		return toMessage(row);
	}

	async list(conversationId: string): Promise<AgentMessage[]> {
		const rows = await this.db.query.agentMessages.findMany({
			where: eq(schema.agentMessages.conversationId, conversationId),
			orderBy: [asc(schema.agentMessages.seq)]
		});
		return rows.map(toMessage);
	}
}

export class AgentActionRepository implements IAgentActionRepository {
	constructor(private db: Database) {}

	async create(action: NewAgentAction, at: Date): Promise<AgentAction> {
		const [row] = await this.db
			.insert(schema.agentActions)
			.values({
				conversationId: action.conversationId,
				callId: action.callId,
				tool: action.tool,
				args: action.args ?? {},
				summary: action.summary,
				status: 'pending',
				createdAt: at
			})
			.returning();
		return toAction(row);
	}

	async findById(id: string): Promise<AgentAction | null> {
		const row = await this.db.query.agentActions.findFirst({
			where: eq(schema.agentActions.id, id)
		});
		return row ? toAction(row) : null;
	}

	async list(conversationId: string): Promise<AgentAction[]> {
		const rows = await this.db.query.agentActions.findMany({
			where: eq(schema.agentActions.conversationId, conversationId),
			orderBy: [asc(schema.agentActions.createdAt)]
		});
		return rows.map(toAction);
	}

	async decide(
		id: string,
		from: AgentActionStatus,
		decision: AgentActionDecision
	): Promise<AgentAction | null> {
		const [row] = await this.db
			.update(schema.agentActions)
			.set({
				status: decision.status,
				result: decision.result ?? null,
				touched: decision.touched ?? null,
				decidedAt: decision.decidedAt
			})
			.where(and(eq(schema.agentActions.id, id), eq(schema.agentActions.status, from)))
			.returning();
		return row ? toAction(row) : null;
	}
}

function toColumns(body: AgentMessageBody): {
	role: AgentMessageBody['role'];
	content: Record<string, unknown>;
	toolCalls: AgentToolCall[] | null;
} {
	switch (body.role) {
		case 'user':
			return { role: 'user', content: { text: body.text }, toolCalls: null };
		case 'assistant':
			return { role: 'assistant', content: { text: body.text }, toolCalls: body.toolCalls };
		case 'tool':
			return {
				role: 'tool',
				content: { callId: body.callId, name: body.name, result: body.result ?? null },
				toolCalls: null
			};
	}
}

function toMessage(row: schema.AgentMessageRow): AgentMessage {
	const base = { id: row.id, conversationId: row.conversationId, createdAt: row.createdAt };
	const content = (row.content ?? {}) as Record<string, unknown>;
	switch (row.role) {
		case 'user':
			return { ...base, role: 'user', text: String(content.text ?? '') };
		case 'assistant':
			return {
				...base,
				role: 'assistant',
				text: typeof content.text === 'string' ? content.text : null,
				toolCalls: Array.isArray(row.toolCalls) ? (row.toolCalls as AgentToolCall[]) : []
			};
		case 'tool':
			return {
				...base,
				role: 'tool',
				callId: String(content.callId ?? ''),
				name: String(content.name ?? ''),
				result: content.result ?? null
			};
		default:
			throw new Error(`Unknown agent message role ${row.role}`);
	}
}

function toAction(row: schema.AgentActionRow): AgentAction {
	const status = STATUSES.find((candidate) => candidate === row.status);
	if (!status) throw new Error(`Unknown agent action status ${row.status}`);
	return {
		id: row.id,
		conversationId: row.conversationId,
		callId: row.callId,
		tool: row.tool,
		args: row.args,
		summary: row.summary,
		status,
		result: row.result ?? null,
		touched: Array.isArray(row.touched) ? (row.touched as Touched[]) : [],
		createdAt: row.createdAt,
		decidedAt: row.decidedAt
	};
}
