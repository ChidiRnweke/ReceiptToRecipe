import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { HouseholdEventRepository } from '../../src/lib/repositories/HouseholdEventRepository';
import { NeedsYouAnswerRepository } from '../../src/lib/repositories/NeedsYouAnswerRepository';

describe('HouseholdEventRepository and NeedsYouAnswerRepository (DB)', () => {
	let events: HouseholdEventRepository;
	let answers: NeedsYouAnswerRepository;
	let userId: string;
	let householdId: string;
	let otherHouseholdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		events = new HouseholdEventRepository(db);
		answers = new NeedsYouAnswerRepository(db);
		const users = new UserRepository(db);
		userId = (
			await users.create({ email: 'h@example.com', name: 'Sam', authProviderId: 'oauth-h1' })
		).id;
		const otherId = (
			await users.create({ email: 'x@example.com', name: 'Other', authProviderId: 'oauth-h2' })
		).id;
		householdId = await createHouseholdFor(userId);
		otherHouseholdId = await createHouseholdFor(otherId, 'Other kitchen');
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	const shopAt = (iso: string, household = householdId) =>
		events.append({
			householdId: household,
			actorUserId: userId,
			kind: 'SHOP_DONE',
			payload: { shopId: iso },
			createdAt: new Date(iso)
		});

	describe('household events', () => {
		it('keeps the payload', async () => {
			await events.append({
				householdId,
				actorUserId: userId,
				kind: 'PLANNED',
				payload: { from: 20400, to: 20403 },
				createdAt: new Date('2026-11-04T18:00:00Z')
			});
			const [stored] = await events.listSince(householdId, new Date('2026-11-04T00:00:00Z'));
			expect(stored.payload).toEqual({ from: 20400, to: 20403 });
		});

		it('lists the events since a moment, newest first', async () => {
			await shopAt('2026-11-03T10:00:00Z');
			await shopAt('2026-11-04T10:00:00Z');
			await shopAt('2026-11-04T17:00:00Z');
			const listed = await events.listSince(householdId, new Date('2026-11-04T00:00:00Z'));
			expect(listed.map((e) => e.payload.shopId)).toEqual([
				'2026-11-04T17:00:00Z',
				'2026-11-04T10:00:00Z'
			]);
		});

		it('lists only the household’s own events', async () => {
			await shopAt('2026-11-04T10:00:00Z', otherHouseholdId);
			expect(await events.listSince(householdId, new Date('2026-11-01T00:00:00Z'))).toEqual([]);
		});

		it('deletes events by id within the household', async () => {
			const event = await shopAt('2026-11-04T10:00:00Z');
			await events.deleteByIds(householdId, [event.id]);
			expect(await events.listSince(householdId, new Date('2026-11-01T00:00:00Z'))).toEqual([]);
		});

		it('does not delete another household’s event', async () => {
			const event = await shopAt('2026-11-04T10:00:00Z', otherHouseholdId);
			await events.deleteByIds(householdId, [event.id]);
			expect(
				await events.listSince(otherHouseholdId, new Date('2026-11-01T00:00:00Z'))
			).toHaveLength(1);
		});
	});

	describe('needs-you answers', () => {
		const answer = (key: string, value = 'dismiss') =>
			answers.save({ householdId, userId, key, answer: value, answeredAt: new Date() });

		it('lists the keys a member answered', async () => {
			await answer('shopDayOffer:3');
			expect(await answers.listKeys(householdId, userId)).toEqual(['shopDayOffer:3']);
		});

		it('replaces an earlier answer to the same question', async () => {
			await answer('shopDayOffer:3', 'dismiss');
			await answer('shopDayOffer:3', 'habit.acceptShopDays');
			expect(await answers.listKeys(householdId, userId)).toEqual(['shopDayOffer:3']);
		});

		it('keeps each member’s answers apart', async () => {
			await answer('shopDayOffer:3');
			expect(await answers.listKeys(otherHouseholdId, userId)).toEqual([]);
		});
	});
});
