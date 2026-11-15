import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { RecipeRepository } from '../../src/lib/repositories/RecipeRepositories';

describe('RecipeRepository tags (DB)', () => {
	let recipes: RecipeRepository;
	let owner: { userId: string; householdId: string };

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		recipes = new RecipeRepository(db);
		const userId = (
			await new UserRepository(db).create({
				email: 't@example.com',
				name: 'Tags Test',
				authProviderId: 'oauth-t1'
			})
		).id;
		owner = { userId, householdId: await createHouseholdFor(userId) };
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	const create = (title: string, judged: boolean | null) =>
		recipes.create({
			...owner,
			title,
			instructions: 'Serve.',
			...(judged === null
				? {}
				: {
						tags: ['vegan', 'main'],
						tagSource: { rule: ['vegan'], ai: judged ? ['main'] : null }
					})
		});

	it('reads the tags back', async () => {
		const dal = await create('Dal', true);
		expect((await recipes.findById(dal.id))?.tags).toEqual(['vegan', 'main']);
	});

	it('reads where the tags came from', async () => {
		const dal = await create('Dal', true);
		expect((await recipes.findById(dal.id))?.tagSource).toEqual({ rule: ['vegan'], ai: ['main'] });
	});

	it('keeps an untagged recipe untagged', async () => {
		const dal = await create('Dal', null);
		expect((await recipes.findById(dal.id))?.tags).toBeNull();
	});

	it('finds the recipes the model has not judged', async () => {
		const untagged = await create('Untagged', null);
		const ruleOnly = await create('Rule only', false);
		await create('Judged', true);
		const found = await recipes.findNeedingTags(null, 20);
		expect(found.map((r) => r.id).sort()).toEqual([untagged.id, ruleOnly.id].sort());
	});

	it('reads the next batch after the last id', async () => {
		const ids = [];
		for (let i = 0; i < 3; i++) ids.push((await create(`R${i}`, null)).id);
		ids.sort();
		const next = await recipes.findNeedingTags(ids[0], 20);
		expect(next.map((r) => r.id)).toEqual(ids.slice(1));
	});
});
