import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { PlannedMealRepository } from '../../src/lib/repositories/PlannedMealRepository';

describe('PlannedMealRepository (DB)', () => {
	let repo: PlannedMealRepository;
	let userId: string;
	let householdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		repo = new PlannedMealRepository(db);
		const users = new UserRepository(db);
		userId = (
			await users.create({ email: 'p@example.com', name: 'Plan Test', authProviderId: 'oauth-p1' })
		).id;
		householdId = await createHouseholdFor(userId);
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	function meal(overrides: Partial<Parameters<PlannedMealRepository['create']>[0]> = {}) {
		return repo.create({
			userId,
			householdId,
			mealName: 'Chickpea curry',
			plannedDate: new Date('2026-11-16T12:00:00Z'),
			plannedCalories: 620,
			mealType: 'DINNER',
			...overrides
		});
	}

	it('starts a meal with no extra portions', async () => {
		expect((await meal()).extraPortions).toBe(0);
	});

	it('starts a meal as not prep', async () => {
		expect((await meal()).isPrep).toBe(false);
	});

	it('stores a prep session with its boxes', async () => {
		const prep = await meal({ mealType: 'PREP', isPrep: true, extraPortions: 4 });
		const read = await repo.findById(prep.id);
		expect([read?.mealType, read?.isPrep, read?.extraPortions]).toEqual(['PREP', true, 4]);
	});

	it('keeps the leftover link of a lunch', async () => {
		const dinner = await meal();
		const lunch = await meal({ mealType: 'LUNCH', leftoverOfId: dinner.id });
		expect((await repo.findById(lunch.id))?.leftoverOfId).toBe(dinner.id);
	});

	it('clears the leftover link when the source meal is deleted', async () => {
		const dinner = await meal();
		const lunch = await meal({ mealType: 'LUNCH', leftoverOfId: dinner.id });
		await repo.delete(dinner.id);
		expect((await repo.findById(lunch.id))?.leftoverOfId).toBeNull();
	});

	it('keeps the lunch when the source meal is deleted', async () => {
		const dinner = await meal();
		const lunch = await meal({ mealType: 'LUNCH', leftoverOfId: dinner.id });
		await repo.delete(dinner.id);
		expect(await repo.findById(lunch.id)).not.toBeNull();
	});
});
