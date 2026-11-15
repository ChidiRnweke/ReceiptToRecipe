import { describe, it, expect, beforeEach } from 'vitest';
import type { Actor } from '../../../src/lib/models/household';
import { cookbookRef } from '../../../src/lib/models/recipes';
import { MockRecipeIngredientRepository, MockRecipeRepository } from '../../mocks';
import { createCookbook } from '../../fakes/cookbook';

const noor: Actor = {
	userId: 'user-noor',
	householdId: 'household-noor',
	memberId: 'member-noor',
	displayName: 'Noor',
	roles: { plans: true, shops: true, cooks: true },
	timeZone: 'UTC'
};
const marc: Actor = {
	...noor,
	userId: 'user-marc',
	householdId: 'household-marc',
	memberId: 'member-marc',
	displayName: 'Marc'
};

const offer = { dietTags: [], avoid: [], wanted: [], day: 20407, limit: 10 };

describe('CookbookService', () => {
	let recipes: MockRecipeRepository;
	let ingredients: MockRecipeIngredientRepository;
	let cookbook: ReturnType<typeof createCookbook>;

	beforeEach(() => {
		recipes = new MockRecipeRepository();
		ingredients = new MockRecipeIngredientRepository();
		recipes.setIngredientRepository(ingredients);
		cookbook = createCookbook(recipes, ingredients);
	});

	describe('adopting a catalog recipe', () => {
		it('copies it into the household as a COOKBOOK recipe', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			expect((await cookbook.service.adopt(noor, lentils.id)).source).toBe('COOKBOOK');
		});

		it('remembers which catalog recipe the copy came from', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			expect((await cookbook.service.adopt(noor, lentils.id)).cookbookRecipeId).toBe(lentils.id);
		});

		it('returns the same copy when the household adopts it again', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			const first = await cookbook.service.adopt(noor, lentils.id);
			expect((await cookbook.service.adopt(noor, lentils.id)).id).toBe(first.id);
		});

		it('makes one copy per household, however often it is adopted', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			await cookbook.service.adopt(noor, lentils.id);
			await cookbook.service.adopt(noor, lentils.id);
			expect(await recipes.findByHouseholdId(noor.householdId)).toHaveLength(1);
		});

		it('gives another household its own copy', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			const mine = await cookbook.service.adopt(noor, lentils.id);
			expect((await cookbook.service.adopt(marc, lentils.id)).id).not.toBe(mine.id);
		});

		it('copies the ingredients', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			const copy = await cookbook.service.adopt(noor, lentils.id);
			expect((await ingredients.findByRecipeId(copy.id)).map((row) => row.name)).toEqual([
				'red lentil',
				'onion'
			]);
		});

		it('copies the steps with their verbs', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			const copy = await cookbook.service.adopt(noor, lentils.id);
			expect((await cookbook.steps.findByRecipeId(copy.id)).map((step) => step.verb)).toEqual([
				null,
				'Simmer'
			]);
		});

		it('copies the tags', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			expect((await cookbook.service.adopt(noor, lentils.id)).tags).toEqual(lentils.tags);
		});

		it('copies the picture', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil', 'onion']);
			await cookbook.catalog.updatePicture(lentils.id, {
				imageUrl: '/uploads/recipes/cookbook-lentils.png',
				imageSource: 'GENERATED',
				imageStatus: 'DONE'
			});
			expect((await cookbook.service.adopt(noor, lentils.id)).imageUrl).toBe(
				'/uploads/recipes/cookbook-lentils.png'
			);
		});

		it('refuses a catalog id that does not exist', async () => {
			await expect(
				cookbook.service.adopt(noor, '00000000-0000-4000-8000-000000000000')
			).rejects.toThrow('Recipe not found');
		});
	});

	describe('resolve', () => {
		it('adopts a cookbook ref', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil']);
			const id = await cookbook.service.resolve(noor, cookbookRef(lentils.id));
			expect((await recipes.findById(id))?.cookbookRecipeId).toBe(lentils.id);
		});

		it('passes a household recipe id through', async () => {
			expect(await cookbook.service.resolve(noor, 'recipe-1')).toBe('recipe-1');
		});
	});

	describe('candidates', () => {
		it('names each recipe by its cookbook ref', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil']);
			expect((await cookbook.service.candidates(noor.householdId, offer))[0].id).toBe(
				cookbookRef(lentils.id)
			);
		});

		it('leaves out recipes the household adopted', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil']);
			await cookbook.service.adopt(noor, lentils.id);
			expect(await cookbook.service.candidates(noor.householdId, offer)).toEqual([]);
		});

		it('still offers them to another household', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil']);
			await cookbook.service.adopt(noor, lentils.id);
			expect(await cookbook.service.candidates(marc.householdId, offer)).toHaveLength(1);
		});

		it('leaves out recipes with a member’s allergen', async () => {
			await cookbook.addCatalogRecipe('Satay', ['chicken', 'peanut butter']);
			expect(
				await cookbook.service.candidates(noor.householdId, { ...offer, avoid: ['peanut'] })
			).toEqual([]);
		});

		it('keeps only recipes with the household’s diet', async () => {
			await cookbook.addCatalogRecipe('Roast chicken', ['chicken', 'lemon']);
			const dal = await cookbook.addCatalogRecipe('Dal', ['red lentil', 'onion']);
			expect(
				(
					await cookbook.service.candidates(noor.householdId, {
						...offer,
						dietTags: ['vegetarian']
					})
				).map((recipe) => recipe.id)
			).toEqual([cookbookRef(dal.id)]);
		});

		it('puts recipes that use the kitchen’s items first', async () => {
			await cookbook.addCatalogRecipe('Apple pie', ['apple', 'flour']);
			const leek = await cookbook.addCatalogRecipe('Leek soup', ['leek', 'potato']);
			expect(
				(await cookbook.service.candidates(noor.householdId, { ...offer, wanted: ['leek'] }))[0].id
			).toBe(cookbookRef(leek.id));
		});
	});

	it('puts main dishes before drinks', async () => {
		await cookbook.addCatalogRecipe('A cup of tea', ['tea', 'water'], { tags: [] });
		const stew = await cookbook.addCatalogRecipe('Bean stew', ['bean', 'onion'], {
			tags: ['main']
		});
		expect((await cookbook.service.candidates(noor.householdId, offer))[0].id).toBe(
			cookbookRef(stew.id)
		);
	});

	describe('preview', () => {
		it('links the Wikibooks page’s history for the authors', async () => {
			const lentils = await cookbook.addCatalogRecipe('Red lentil soup', ['red lentil']);
			expect((await cookbook.service.preview(lentils.id))?.attribution.historyUrl).toBe(
				'https://en.wikibooks.org/w/index.php?title=Cookbook:Red_lentil_soup&action=history'
			);
		});
	});
});
