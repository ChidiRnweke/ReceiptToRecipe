import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { KitchenEventRepository } from '../../src/lib/repositories/KitchenEventRepository';
import { HabitAnswerRepository } from '../../src/lib/repositories/HabitAnswerRepository';
import { CupboardItemRepository } from '../../src/lib/repositories/CupboardItemRepository';

describe('KitchenEventRepository (DB)', () => {
	let repo: KitchenEventRepository;
	let answers: HabitAnswerRepository;
	let userId: string;
	let householdId: string;
	let otherHouseholdId: string;
	let cupboard: CupboardItemRepository;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		repo = new KitchenEventRepository(db);
		answers = new HabitAnswerRepository(db);
		cupboard = new CupboardItemRepository(db);
		const users = new UserRepository(db);
		userId = (
			await users.create({
				email: 'k@example.com',
				name: 'Kitchen Test',
				authProviderId: 'oauth-k1'
			})
		).id;
		const otherUserId = (
			await users.create({ email: 'o@example.com', name: 'Other', authProviderId: 'oauth-k2' })
		).id;
		householdId = await createHouseholdFor(userId);
		otherHouseholdId = await createHouseholdFor(otherUserId, 'Other kitchen');
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	function boughtAt(iso: string, itemKey = 'milk', household = householdId) {
		return {
			householdId: household,
			actorUserId: userId,
			occurredAt: new Date(iso),
			kind: 'BOUGHT' as const,
			itemKey,
			quantity: 1.5,
			unit: 'l',
			payload: { category: 'dairy' }
		};
	}

	it('reads back the quantity as a number', async () => {
		const stored = await repo.append(boughtAt('2026-11-10T10:00:00Z'));

		expect(stored.quantity).toBe(1.5);
	});

	it('reads back the payload', async () => {
		const stored = await repo.append(boughtAt('2026-11-10T10:00:00Z'));

		expect(stored.payload).toEqual({ category: 'dairy' });
	});

	it("lists a household's events since a date, oldest first", async () => {
		await repo.appendMany([
			boughtAt('2026-11-12T10:00:00Z', 'eggs'),
			boughtAt('2026-11-01T10:00:00Z', 'old'),
			boughtAt('2026-11-11T10:00:00Z', 'milk'),
			boughtAt('2026-11-11T11:00:00Z', 'other', otherHouseholdId)
		]);

		const events = await repo.listByHouseholdSince(householdId, new Date('2026-11-10T00:00:00Z'));

		expect(events.map((event) => event.itemKey)).toEqual(['milk', 'eggs']);
	});

	it('lists the events of one kind', async () => {
		await repo.appendMany([
			boughtAt('2026-11-11T10:00:00Z'),
			{
				householdId,
				actorUserId: userId,
				occurredAt: new Date('2026-11-11T10:05:00Z'),
				kind: 'SHOP_DONE',
				method: 'RECEIPT'
			}
		]);

		const shops = await repo.listByKind(householdId, 'SHOP_DONE');

		expect(shops.map((event) => event.method)).toEqual(['RECEIPT']);
	});

	it('keeps one answer per household and offer', async () => {
		const base = { householdId, key: 'shopDay:3', answeredBy: userId };
		await answers.save({
			...base,
			answer: 'accepted',
			answeredAt: new Date('2026-11-10T20:00:00Z')
		});
		await answers.save({
			...base,
			answer: 'declined',
			answeredAt: new Date('2026-11-11T20:00:00Z')
		});

		const stored = await answers.listByHousehold(householdId);

		expect(stored.map((answer) => answer.answer)).toEqual(['declined']);
	});

	describe('events of a cupboard row', () => {
		async function cupboardRow() {
			return (await cupboard.create({ userId, householdId, itemName: 'Rice' })).id;
		}

		it('deletes the events of the given kinds written for the row', async () => {
			const rowId = await cupboardRow();
			await repo.append({ ...boughtAt('2026-11-10T10:00:00Z', 'rice'), cupboardItemId: rowId });

			await repo.deleteByCupboardItem(householdId, rowId, ['BOUGHT']);

			expect(await repo.listByHouseholdSince(householdId, new Date(0))).toEqual([]);
		});

		it('keeps the events of other kinds written for the row', async () => {
			const rowId = await cupboardRow();
			await repo.append({
				householdId,
				occurredAt: new Date('2026-11-11T10:00:00Z'),
				kind: 'CORRECTED_GONE',
				itemKey: 'rice',
				cupboardItemId: rowId
			});

			await repo.deleteByCupboardItem(householdId, rowId, ['BOUGHT']);

			const left = await repo.listByHouseholdSince(householdId, new Date(0));
			expect(left.map((event) => event.kind)).toEqual(['CORRECTED_GONE']);
		});

		it('keeps purchases of the same item that no cupboard row wrote', async () => {
			const rowId = await cupboardRow();
			await repo.append(boughtAt('2026-11-10T10:00:00Z', 'rice'));

			await repo.deleteByCupboardItem(householdId, rowId, ['BOUGHT']);

			expect(await repo.listByHouseholdSince(householdId, new Date(0))).toHaveLength(1);
		});
	});
});
