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
	AgentRunRepository
} from '../../src/lib/repositories/AgentRepositories';
import { BasilBusyError, type NewAgentRun } from '../../src/lib/models/agent';
import { v4 as uuid } from 'uuid';

const AT = new Date('2026-11-14T16:50:00Z');

describe('Agent repositories (DB)', () => {
	let conversations: AgentConversationRepository;
	let messages: AgentMessageRepository;
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
			await messages.append(
				conversation.id,
				{ role: 'tool', callId: 'c1', name: 'get_plan', result: { slots: [] } },
				AT
			);
			const listed = await messages.list(conversation.id);
			expect(listed.map((message) => message.role)).toEqual(['user', 'assistant', 'tool']);
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

		it('keeps a tool result', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const result = { failure: 'Recipe not found', recovery: 'Look it up.' };
			await messages.append(
				conversation.id,
				{ role: 'tool', callId: 'c1', name: 'get_recipe', result },
				AT
			);
			const [stored] = await messages.list(conversation.id);
			expect(stored).toMatchObject({ role: 'tool', callId: 'c1', result });
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
		const newRun = (conversationId: string, requestId = uuid()): NewAgentRun => ({
			conversationId,
			householdId,
			userId,
			requestId,
			input: {
				request: { kind: 'message', text: 'Hello', pageContext: null },
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
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			expect((await runs.listEvents(run.id, 0)).map((r) => r.event)).toEqual([
				{ type: 'run_queued' }
			]);
		});

		it('returns the earlier run for a request id used again', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const requestId = uuid();
			const first = await runs.submit(newRun(conversation.id, requestId), null, AT);
			const second = await runs.submit(newRun(conversation.id, requestId), null, AT);
			expect([second.run.id, second.created]).toEqual([first.run.id, false]);
		});

		it('refuses a second active run in the conversation', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await runs.submit(newRun(conversation.id), null, AT);
			await expect(runs.submit(newRun(conversation.id), null, AT)).rejects.toThrow(BasilBusyError);
		});

		it('stores no message for a refused run', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			await runs.submit(newRun(conversation.id), null, AT);
			await runs
				.submit(newRun(conversation.id), { role: 'user', text: 'Again' }, AT)
				.catch(() => undefined);
			expect(await messages.list(conversation.id)).toEqual([]);
		});

		it('takes a new run once the active one has settled', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			await runs.transition(run.id, ['queued'], { status: 'completed', finishedAt: AT }, null, AT);
			const next = await runs.submit(newRun(conversation.id), null, AT);
			expect(next.created).toBe(true);
		});

		it('moves a run on only from the expected status', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			expect(
				await runs.transition(run.id, ['running'], { status: 'completed' }, null, AT)
			).toBeNull();
		});

		it('appends the transition’s event with it', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			await runs.transition(run.id, ['queued'], { status: 'running' }, { type: 'run_started' }, AT);
			expect((await runs.listEvents(run.id, 0)).at(-1)?.event).toEqual({ type: 'run_started' });
		});

		it('lists events after a cursor', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run, cursor } = await runs.submit(newRun(conversation.id), null, AT);
			await runs.appendEvent(run.id, { type: 'text_delta', text: 'Hi' }, AT);
			expect((await runs.listEvents(run.id, cursor)).map((r) => r.event)).toEqual([
				{ type: 'text_delta', text: 'Hi' }
			]);
		});

		it('reads the latest cursor', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			const last = await runs.appendEvent(run.id, { type: 'completed' }, AT);
			expect(await runs.latestCursor(run.id)).toBe(last.cursor);
		});

		it('finds the active run of a conversation', async () => {
			const conversation = await conversations.create(householdId, userId, AT);
			const { run } = await runs.submit(newRun(conversation.id), null, AT);
			expect((await runs.findActive(conversation.id))?.id).toBe(run.id);
		});
	});
});
