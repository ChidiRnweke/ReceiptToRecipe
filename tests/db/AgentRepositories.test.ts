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
	AgentMessageRepository
} from '../../src/lib/repositories/AgentRepositories';

const AT = new Date('2026-11-14T16:50:00Z');

describe('Agent repositories (DB)', () => {
	let conversations: AgentConversationRepository;
	let messages: AgentMessageRepository;
	let actions: AgentActionRepository;
	let userId: string;
	let otherUserId: string;
	let householdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		conversations = new AgentConversationRepository(db);
		messages = new AgentMessageRepository(db);
		actions = new AgentActionRepository(db);
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
});
