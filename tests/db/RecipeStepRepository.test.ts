import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { RecipeRepository } from '../../src/lib/repositories/RecipeRepositories';
import { RecipeStepRepository } from '../../src/lib/repositories/RecipeStepRepository';

describe('RecipeStepRepository (DB)', () => {
	let steps: RecipeStepRepository;
	let recipes: RecipeRepository;
	let recipeId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		steps = new RecipeStepRepository(db);
		recipes = new RecipeRepository(db);
		const userId = (
			await new UserRepository(db).create({
				email: 's@example.com',
				name: 'Steps Test',
				authProviderId: 'oauth-s1'
			})
		).id;
		const householdId = await createHouseholdFor(userId);
		recipeId = (
			await recipes.create({
				userId,
				householdId,
				title: 'Dal',
				instructions: 'Sweat the onion.',
				source: 'SNAPPED'
			})
		).id;
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	it('reads the steps back in position order', async () => {
		await steps.replaceForRecipe(recipeId, [
			{ position: 1, verb: 'Simmer', text: 'the lentils, 20 min.', minutes: 20 },
			{ position: 0, verb: 'Sweat', text: 'the onion.', minutes: 8 }
		]);

		expect((await steps.findByRecipeId(recipeId)).map((step) => step.verb)).toEqual([
			'Sweat',
			'Simmer'
		]);
	});

	it('stores the technique key of a verb', async () => {
		await steps.replaceForRecipe(recipeId, [
			{ position: 0, verb: 'Sauté', text: 'the mushrooms.', minutes: null }
		]);

		expect((await steps.findByRecipeId(recipeId))[0].techniqueKey).toBe('saute');
	});

	it('replaces the earlier steps', async () => {
		await steps.replaceForRecipe(recipeId, [
			{ position: 0, verb: 'Boil', text: 'the rice.', minutes: 12 }
		]);
		await steps.replaceForRecipe(recipeId, [
			{ position: 0, verb: null, text: 'Serve.', minutes: null }
		]);

		expect((await steps.findByRecipeId(recipeId)).map((step) => step.text)).toEqual(['Serve.']);
	});

	it('removes the steps with their recipe', async () => {
		await steps.replaceForRecipe(recipeId, [
			{ position: 0, verb: 'Rest', text: 'the chicken.', minutes: 3 }
		]);
		await recipes.delete(recipeId);

		expect(await steps.findByRecipeId(recipeId)).toEqual([]);
	});

	it('keeps the snapped source', async () => {
		expect((await recipes.findById(recipeId))?.source).toBe('SNAPPED');
	});
});
