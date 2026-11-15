import { and, asc, desc, eq, gt, inArray, max } from 'drizzle-orm';
import { protocol } from '@openai/agents';
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
	AgentRun,
	AgentRunStatus,
	AgentRunTransition,
	AgentSessionItem,
	BasilEvent,
	BasilRunEventRecord,
	NewAgentAction,
	NewAgentRun,
	Touched
} from '$lib/models/agent';
import {
	ACTIVE_RUN_STATUSES,
	AGENT_RUN_STATUSES,
	BasilBusyError,
	basilEventSchema,
	basilRunInputSchema
} from '$lib/models/agent';
import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository,
	IAgentRunRepository,
	IAgentSessionRepository
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

export class AgentSessionRepository implements IAgentSessionRepository {
	constructor(private db: Database) {}

	async list(conversationId: string): Promise<AgentSessionItem[]> {
		const rows = await this.db.query.agentSessionItems.findMany({
			where: eq(schema.agentSessionItems.conversationId, conversationId),
			orderBy: [asc(schema.agentSessionItems.position)]
		});
		// Read back through the SDK's own schema, so a stored row is an item the SDK accepts.
		return rows.map((row) => protocol.ModelItem.parse(row.item));
	}

	async replace(
		conversationId: string,
		items: readonly AgentSessionItem[],
		at: Date
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.agentSessionItems)
				.where(eq(schema.agentSessionItems.conversationId, conversationId));
			if (items.length === 0) return;
			await tx
				.insert(schema.agentSessionItems)
				.values(items.map((item, position) => ({ conversationId, position, item, createdAt: at })));
		});
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

	async findByCall(conversationId: string, callId: string): Promise<AgentAction | null> {
		const row = await this.db.query.agentActions.findFirst({
			where: and(
				eq(schema.agentActions.conversationId, conversationId),
				eq(schema.agentActions.callId, callId)
			)
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

/** The unique index that keeps one active run per conversation. */
const ONE_ACTIVE_INDEX = 'agent_runs_one_active_idx';

export class AgentRunRepository implements IAgentRunRepository {
	constructor(private db: Database) {}

	async submit(
		run: NewAgentRun,
		userMessage: AgentMessageBody,
		at: Date
	): Promise<{ run: AgentRun; created: boolean; cursor: number }> {
		try {
			return await this.db
				.transaction(async (tx) => {
					const [row] = await tx
						.insert(schema.agentRuns)
						.values({
							conversationId: run.conversationId,
							householdId: run.householdId,
							userId: run.userId,
							requestId: run.requestId,
							input: run.input,
							status: 'queued',
							createdAt: at
						})
						.onConflictDoNothing({
							target: [schema.agentRuns.userId, schema.agentRuns.requestId]
						})
						.returning();
					if (!row) return null;
					const { role, content, toolCalls } = toColumns(userMessage);
					await tx.insert(schema.agentMessages).values({
						conversationId: run.conversationId,
						role,
						content,
						toolCalls,
						createdAt: at
					});
					const [event] = await tx
						.insert(schema.agentRunEvents)
						.values({ runId: row.id, event: { type: 'run_queued' }, createdAt: at })
						.returning();
					return { run: toRun(row), created: true, cursor: event.cursor };
				})
				.then(async (result) => result ?? (await this.existing(run.userId, run.requestId)));
		} catch (error) {
			if (violates(error, ONE_ACTIVE_INDEX)) throw new BasilBusyError();
			throw error;
		}
	}

	private async existing(
		userId: string,
		requestId: string
	): Promise<{ run: AgentRun; created: boolean; cursor: number }> {
		const run = await this.findByRequest(userId, requestId);
		if (!run) throw new Error('The run for this request disappeared');
		return { run, created: false, cursor: await this.latestCursor(run.id) };
	}

	async findById(id: string): Promise<AgentRun | null> {
		const row = await this.db.query.agentRuns.findFirst({ where: eq(schema.agentRuns.id, id) });
		return row ? toRun(row) : null;
	}

	async findByRequest(userId: string, requestId: string): Promise<AgentRun | null> {
		const row = await this.db.query.agentRuns.findFirst({
			where: and(eq(schema.agentRuns.userId, userId), eq(schema.agentRuns.requestId, requestId))
		});
		return row ? toRun(row) : null;
	}

	async findActive(conversationId: string): Promise<AgentRun | null> {
		const row = await this.db.query.agentRuns.findFirst({
			where: and(
				eq(schema.agentRuns.conversationId, conversationId),
				inArray(schema.agentRuns.status, [...ACTIVE_RUN_STATUSES])
			)
		});
		return row ? toRun(row) : null;
	}

	async findParked(conversationId: string): Promise<AgentRun | null> {
		const row = await this.db.query.agentRuns.findFirst({
			where: and(
				eq(schema.agentRuns.conversationId, conversationId),
				eq(schema.agentRuns.status, 'awaiting_approval')
			),
			orderBy: [desc(schema.agentRuns.createdAt)]
		});
		return row ? toRun(row) : null;
	}

	async listByStatus(statuses: readonly AgentRunStatus[]): Promise<AgentRun[]> {
		if (statuses.length === 0) return [];
		const rows = await this.db.query.agentRuns.findMany({
			where: inArray(schema.agentRuns.status, [...statuses]),
			orderBy: [asc(schema.agentRuns.createdAt)]
		});
		return rows.map(toRun);
	}

	async transition(
		id: string,
		from: readonly AgentRunStatus[],
		to: AgentRunTransition,
		event: BasilEvent | null,
		at: Date
	): Promise<AgentRun | null> {
		return this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(schema.agentRuns)
				.set({
					status: to.status,
					...(to.serializedState !== undefined ? { serializedState: to.serializedState } : {}),
					...(to.failure !== undefined ? { failure: to.failure } : {}),
					...(to.cancelRequestedAt ? { cancelRequestedAt: to.cancelRequestedAt } : {}),
					...(to.finishedAt ? { finishedAt: to.finishedAt } : {})
				})
				.where(and(eq(schema.agentRuns.id, id), inArray(schema.agentRuns.status, [...from])))
				.returning();
			if (!row) return null;
			if (event) await tx.insert(schema.agentRunEvents).values({ runId: id, event, createdAt: at });
			return toRun(row);
		});
	}

	async appendEvent(runId: string, event: BasilEvent, at: Date): Promise<BasilRunEventRecord> {
		const [row] = await this.db
			.insert(schema.agentRunEvents)
			.values({ runId, event, createdAt: at })
			.returning();
		return toEventRecord(row);
	}

	async listEvents(runId: string, after: number): Promise<BasilRunEventRecord[]> {
		const rows = await this.db.query.agentRunEvents.findMany({
			where: and(eq(schema.agentRunEvents.runId, runId), gt(schema.agentRunEvents.cursor, after)),
			orderBy: [asc(schema.agentRunEvents.cursor)]
		});
		return rows.map(toEventRecord);
	}

	async latestCursor(runId: string): Promise<number> {
		const [row] = await this.db
			.select({ cursor: max(schema.agentRunEvents.cursor) })
			.from(schema.agentRunEvents)
			.where(eq(schema.agentRunEvents.runId, runId));
		return Number(row?.cursor ?? 0);
	}
}

/** Whether a Postgres error is a unique violation of the named index. */
function violates(error: unknown, constraint: string): boolean {
	const candidates = [error, (error as { cause?: unknown } | null)?.cause];
	return candidates.some(
		(candidate) =>
			typeof candidate === 'object' &&
			candidate !== null &&
			(candidate as { code?: unknown }).code === '23505' &&
			(candidate as { constraint?: unknown }).constraint === constraint
	);
}

function toRun(row: schema.AgentRunRow): AgentRun {
	const status = AGENT_RUN_STATUSES.find((candidate) => candidate === row.status);
	if (!status) throw new Error(`Unknown agent run status ${row.status}`);
	const input = basilRunInputSchema.parse(row.input);
	return {
		id: row.id,
		conversationId: row.conversationId,
		householdId: row.householdId,
		userId: row.userId,
		requestId: row.requestId,
		input,
		status,
		serializedState: row.serializedState,
		failure: row.failure,
		cancelRequestedAt: row.cancelRequestedAt,
		createdAt: row.createdAt,
		finishedAt: row.finishedAt
	};
}

function toEventRecord(row: schema.AgentRunEventRow): BasilRunEventRecord {
	return { runId: row.runId, cursor: row.cursor, event: basilEventSchema.parse(row.event) };
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
