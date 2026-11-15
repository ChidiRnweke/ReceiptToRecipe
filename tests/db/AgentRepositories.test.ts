import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	setupTestDb,
	cleanTables,
	teardownTestDb,
	createHouseholdFor,
	getTestDb
} from '../helpers/testDb';
import * as schema from '../../src/lib/db/schema';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import {
	AgentActionRepository,
	AgentConversationRepository,
	AgentMessageRepository,
	AgentRunRepository,
	AgentSessionRepository
} from '../../src/lib/repositories/AgentRepositories';
import { BasilBusyError, type NewAgentRun } from '../../src/lib/models/agent';
import { v4 as uuid } from 'uuid';

const AT = new Date('2026-11-14T16:50:00Z');

describe('Agent repositories (DB)', () => {
	let conversations: AgentConversationRepository;
	let messages: AgentMessageRepository;
	let sessions: AgentSessionRepository;
	let actions: AgentActionRepository;
	let runs: AgentRunRepository;
	let userId: string;
	let otherUserId: string;
	let householdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		conversations = new AgentConversationRepository(db);
		messages = new AgentMessageRepository(db);
		sessions = new AgentSessionRepository(db);
		actions = new AgentActionRepository(db);
		runs = new AgentRunRepository(db);
		const users = new UserRepository(db);
		userId = (
			await users.create({ email: 'n@example.com', name: 'Noor', authProviderId: 'oauth-b1' })
		).id;
		otherUserId = (
			await users.create({ email: 's@example.com', name: 'Sam', authProviderId: 'oauth-b2' })
		).id;
		householdId = await createHouseholdFor(userId);
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('agent_conversations', () => {
		it('finds the member’s latest conversation', async () => {
			await conversations.create(householdId, userId, new Date('2026-11-01T10:00:00Z'));
			const latest = await conversations.create(householdId, userId, AT);
			expect((await conversations.findLatest(householdId, userId))?.id).toBe(latest.id);
		});

		it('keeps one member’s conversation from another', async () => {
			await conversations.create(householdId, userId, AT);
			expect(await conversations.findLatest(householdId, otherUserId)).toBeNull();
		});
	});

	describe('agent_messages', () => {
		it('lists the messages of one moment in the order they were written', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await messages.append(conversation.id, { role: 'user', text: 'What’s for dinner?' }, AT);
			await messages.append(
				conversation.id,
				{
					role: 'assistant',
					text: null,
					toolCalls: [{ id: 'c1', name: 'get_plan', arguments: '{}' }]
				},
				AT
			);
			const listed = await messages.list(conversation.id);
			expect(listed.map((message) => message.role)).toEqual(['user', 'assistant']);
		});

		it('keeps the tool calls of an assistant message', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const toolCalls = [{ id: 'c1', name: 'get_plan', arguments: '{}' }];
			await messages.append(
				conversation.id,
				{ role: 'assistant', text: 'Looking.', toolCalls },
				AT
			);
			const [stored] = await messages.list(conversation.id);
			expect(stored).toMatchObject({ role: 'assistant', toolCalls });
		});
	});

	describe('agent_session_items', () => {
		const items = [
			{ type: 'message' as const, role: 'user' as const, content: 'What’s for dinner?' },
			{
				type: 'function_call' as const,
				callId: 'c1',
				name: 'get_plan',
				arguments: '{}',
				status: 'completed' as const
			}
		];

		it('reads back the items in order', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await sessions.replace(conversation.id, items, AT);
			expect(await sessions.list(conversation.id)).toEqual(items);
		});

		it('replaces the items of a conversation', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await sessions.replace(conversation.id, items, AT);
			await sessions.replace(conversation.id, items.slice(0, 1), AT);
			expect(await sessions.list(conversation.id)).toHaveLength(1);
		});

		it('keeps one conversation’s items from another', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const other = await conversations.create(householdId, otherUserId, AT);
			await sessions.replace(conversation.id, items, AT);
			expect(await sessions.list(other.id)).toEqual([]);
		});
	});

	describe('agent_actions', () => {
		const propose = async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			return actions.create(
				{
					conversationId: conversation.id,
					callId: 'c1',
					tool: 'remove_plan_slot',
					args: { plannedMealId: '6f1c2c1e-0000-4000-8000-000000000001' },
					summary: 'Take the curry off Thursday’s dinner.'
				},
				AT
			);
		};

		it('starts pending', async () => {
			expect((await propose()).status).toBe('pending');
		});

		it('records the outcome with what it touched', async () => {
			const action = await propose();
			const touched = [
				{ kind: 'planned-meal' as const, id: '20410:DINNER', label: 'Curry', door: 'plan' as const }
			];
			await actions.decide(action.id, 'pending', { status: 'executed', touched, decidedAt: AT });
			expect((await actions.findById(action.id))?.touched).toEqual(touched);
		});

		it('finds the action that answers a tool call', async () => {
			const action = await propose();
			expect((await actions.findByCall(action.conversationId, 'c1'))?.id).toBe(action.id);
		});

		it('decides an action only once', async () => {
			const action = await propose();
			await actions.decide(action.id, 'pending', { status: 'declined', decidedAt: AT });
			const again = await actions.decide(action.id, 'pending', {
				status: 'approved',
				decidedAt: AT
			});
			expect(again).toBeNull();
		});

		it('goes when its household is deleted', async () => {
			const action = await propose();
			await getTestDb().delete(schema.households).where(eq(schema.households.id, householdId));
			expect(await actions.findById(action.id)).toBeNull();
		});
	});

	describe('agent_runs', () => {
		const HELLO = { role: 'user' as const, text: 'Hello' };
		const newRun = (conversationId: string, requestId = uuid()): NewAgentRun => ({
			conversationId,
			householdId,
			userId,
			requestId,
			input: {
				request: { text: 'Hello', pageContext: null },
				actor: {
					userId,
					householdId,
					memberId: 'member-1',
					displayName: 'Noor',
					roles: { plans: true, shops: true, cooks: true },
					timeZone: 'UTC'
				},
				timeZone: 'UTC'
			}
		});

		it('stores the person’s message with the run', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await runs.submit(newRun(conversation.id), { role: 'user', text: 'Hello' }, AT);
			expect((await messages.list(conversation.id)).map((m) => m.role)).toEqual(['user']);
		});

		it('starts the stream with run_queued', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			expect((await runs.listEvents(run.id, 0)).map((r) => r.event)).toEqual([
				{ type: 'run_queued' }
			]);
		});

		it('returns the earlier run for a request id used again', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const requestId = uuid();
			const first = await runs.submit(newRun(conversation.id, requestId), HELLO, AT);
			const second = await runs.submit(newRun(conversation.id, requestId), HELLO, AT);
			expect([second.run.id, second.created]).toEqual([first.run.id, false]);
		});

		it('refuses a second active run in the conversation', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await runs.submit(newRun(conversation.id), HELLO, AT);
			await expect(runs.submit(newRun(conversation.id), HELLO, AT)).rejects.toThrow(BasilBusyError);
		});

		it('stores no message for a refused run', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs
				.submit(newRun(conversation.id), { role: 'user', text: 'Again' }, AT)
				.catch(() => undefined);
			expect(await messages.list(conversation.id)).toHaveLength(1);
		});

		it('takes a new run once the active one has settled', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs.transition(run.id, ['queued'], { status: 'completed', finishedAt: AT }, null, AT);
			const next = await runs.submit(newRun(conversation.id), HELLO, AT);
			expect(next.created).toBe(true);
		});

		it('moves a run on only from the expected status', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			expect(
				await runs.transition(run.id, ['running'], { status: 'completed' }, null, AT)
			).toBeNull();
		});

		it('appends the transition’s event with it', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs.transition(run.id, ['queued'], { status: 'running' }, { type: 'run_started' }, AT);
			expect((await runs.listEvents(run.id, 0)).at(-1)?.event).toEqual({ type: 'run_started' });
		});

		it('lists events after a cursor', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run, cursor } = await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs.appendEvent(run.id, { type: 'text_delta', text: 'Hi' }, AT);
			expect((await runs.listEvents(run.id, cursor)).map((r) => r.event)).toEqual([
				{ type: 'text_delta', text: 'Hi' }
			]);
		});

		it('reads the latest cursor', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			const last = await runs.appendEvent(run.id, { type: 'completed' }, AT);
			expect(await runs.latestCursor(run.id)).toBe(last.cursor);
		});

		it('stores the agent’s state when a run parks on a change', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs.transition(
				run.id,
				['queued'],
				{ status: 'awaiting_approval', serializedState: '{"state":1}' },
				null,
				AT
			);
			expect((await runs.findParked(conversation.id))?.serializedState).toBe('{"state":1}');
		});

		it('clears the agent’s state once the run settles', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			await runs.transition(
				run.id,
				['queued'],
				{ status: 'awaiting_approval', serializedState: '{"state":1}' },
				null,
				AT
			);
			const done = await runs.transition(
				run.id,
				['awaiting_approval'],
				{ status: 'completed', serializedState: null },
				null,
				AT
			);
			expect(done?.serializedState).toBeNull();
		});

		it('finds the active run of a conversation', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), HELLO, AT);
			expect((await runs.findActive(conversation.id))?.id).toBe(run.id);
		});
	});
});
