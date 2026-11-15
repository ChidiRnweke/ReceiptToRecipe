import { describe, it, expect, beforeEach } from 'vitest';
import { RecipeBookService } from '../../../src/lib/services/RecipeBookService';
import type { LlmGeneratedRecipe } from '../../../src/lib/services';
import {
	MockCulinaryIntelligence,
	MockImageGenerator,
	MockJobQueue,
	MockRecipeIngredientRepository,
	MockRecipeRepository
} from '../../mocks';
import { InMemoryRecipeStepRepository } from '../../fakes/InMemoryRecipeStepRepository';

const author = { userId: 'user-1', householdId: 'household-1' };

const dal: LlmGeneratedRecipe = {
	title: 'Red lentil dal',
	description: 'Weeknight dal',
	instructions: '',
	steps: [
		{ verb: 'Sweat', text: 'the onion.', minutes: 5 },
		{ verb: 'Simmer', text: 'the lentils.', minutes: 20 }
	],
	servings: 2,
	prepTime: 5,
	cookTime: 20,
	ingredients: [
		{ name: 'red lentils', quantity: 200, unit: 'g', optional: false },
		{ name: 'onion', quantity: 1, unit: 'count', optional: false }
	],
	tags: ['keeps-well', 'main']
};

describe('RecipeBookService tags', () => {
	let recipes: MockRecipeRepository;
	let ingredients: MockRecipeIngredientRepository;
	let model: MockCulinaryIntelligence;
	let book: RecipeBookService;

	beforeEach(() => {
		recipes = new MockRecipeRepository();
		ingredients = new MockRecipeIngredientRepository();
		recipes.setIngredientRepository(ingredients);
		model = new MockCulinaryIntelligence();
		book = new RecipeBookService(
			recipes,
			ingredients,
			new InMemoryRecipeStepRepository(),
			new MockImageGenerator(),
			new MockJobQueue(false),
			model
		);
	});

	/** A recipe stored without tags, as recipes were before tagging. */
	async function untagged(title: string, names: string[]) {
		const recipe = await recipes.create({
			...author,
			title,
			instructions: 'Sweat the onion.\nSimmer it.',
			prepTime: 10,
			cookTime: 15
		});
		await ingredients.createMany(
			names.map((name, orderIndex) => ({
				recipeId: recipe.id,
				name,
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT' as const,
				orderIndex
			}))
		);
		return recipe;
	}

	describe('create', () => {
		it('stores the rule tags and the tags the model gave', async () => {
			const recipe = await book.create(author, { recipe: dal, source: 'GENERATED' });
			expect(recipe.tags).toEqual([
				'vegan',
				'gluten-free',
				'dairy-free',
				'quick',
				'one-pot',
				'keeps-well',
				'main'
			]);
		});

		it('leaves the model’s judgement open when it gave no tags', async () => {
			const recipe = await book.create(author, {
				recipe: { ...dal, tags: undefined },
				source: 'GENERATED'
			});
			expect(recipe.tagSource?.ai).toBeNull();
		});
	});

	describe('tagUntagged', () => {
		it('adds the model’s tags to a recipe that had none', async () => {
			const soup = await untagged('Lentil soup', ['lentils', 'onion']);
			await book.tagUntagged();
			expect((await recipes.findById(soup.id))?.tags).toContain('keeps-well');
		});

		it('gives a recipe its rule tags when the model fails', async () => {
			model.taggingFails = true;
			const soup = await untagged('Lentil soup', ['lentils', 'onion']);
			await book.tagUntagged();
			expect((await recipes.findById(soup.id))?.tags).toEqual([
				'vegan',
				'gluten-free',
				'dairy-free',
				'quick',
				'one-pot'
			]);
		});

		it('keeps the model’s judgement open when the model fails', async () => {
			model.taggingFails = true;
			const soup = await untagged('Lentil soup', ['lentils']);
			await book.tagUntagged();
			expect((await recipes.findById(soup.id))?.tagSource?.ai).toBeNull();
		});

		it('stops asking a failing model for the rest of the run', async () => {
			model.taggingFails = true;
			for (let i = 0; i < 25; i++) await untagged(`Stew ${i}`, ['beans']);
			await book.tagUntagged();
			expect(model.tagBatches).toHaveLength(1);
		});

		it('tags every recipe in batches of 20', async () => {
			for (let i = 0; i < 25; i++) await untagged(`Stew ${i}`, ['beans']);
			const summary = await book.tagUntagged();
			expect(summary).toEqual({ tagged: 25, judged: 25 });
		});

		it('leaves recipes the model judged alone', async () => {
			await book.create(author, { recipe: dal, source: 'GENERATED' });
			const summary = await book.tagUntagged();
			expect(summary.tagged).toBe(0);
		});
	});

	describe('retag', () => {
		it('sets the rule tags again after the ingredients change', async () => {
			const recipe = await book.create(author, { recipe: dal, source: 'GENERATED' });
			await ingredients.createMany([
				{
					recipeId: recipe.id,
					name: 'chorizo',
					quantity: '100',
					unit: 'g',
					unitType: 'WEIGHT',
					orderIndex: 2
				}
			]);
			await book.retag(recipe.id);
			expect((await recipes.findById(recipe.id))?.tags).not.toContain('vegan');
		});

		it('keeps the model’s tags when it sets the rule tags again', async () => {
			const recipe = await book.create(author, { recipe: dal, source: 'GENERATED' });
			await book.retag(recipe.id);
			expect((await recipes.findById(recipe.id))?.tags).toContain('keeps-well');
		});
	});
});
