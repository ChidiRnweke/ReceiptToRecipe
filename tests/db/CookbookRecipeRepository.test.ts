import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import {
	RecipeIngredientRepository,
	RecipeRepository
} from '../../src/lib/repositories/RecipeRepositories';
import { RecipeStepRepository } from '../../src/lib/repositories/RecipeStepRepository';
import { CookbookRecipeRepository } from '../../src/lib/repositories/CookbookRecipeRepository';
import { CookbookService } from '../../src/lib/services/CookbookService';
import type { Actor } from '../../src/lib/models/household';
import { cookbookRow, cookbookStructure } from '../fakes/cookbook';

/** A 768-dimension vector pointing mostly along one axis. */
function axis(index: number): number[] {
	return Array.from({ length: 768 }, (_, i) => (i === index ? 1 : 0.01));
}

const filter = { tagGroups: [], avoid: [], householdId: null, limit: 10 };

describe('CookbookRecipeRepository (DB)', () => {
	let catalog: CookbookRecipeRepository;
	let recipes: RecipeRepository;
	let service: CookbookService;
	let actor: Actor;

	const add = (
		title: string,
		ingredients: string[],
		extra = {},
		embedding: number[] | null = null
	) => catalog.upsert({ ...cookbookRow(cookbookStructure(title, ingredients, extra)), embedding });

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		catalog = new CookbookRecipeRepository(db);
		recipes = new RecipeRepository(db);
		service = new CookbookService(
			catalog,
			recipes,
			new RecipeIngredientRepository(db),
			new RecipeStepRepository(db)
		);
		const userId = (
			await new UserRepository(db).create({
				email: 'c@example.com',
				name: 'Cookbook Test',
				authProviderId: 'oauth-c1'
			})
		).id;
		const householdId = await createHouseholdFor(userId);
		actor = {
			userId,
			householdId,
			memberId: 'member-1',
			displayName: 'Cookbook Test',
			roles: { plans: true, shops: true, cooks: true },
			timeZone: 'UTC'
		};
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('storing pages', () => {
		it('keeps one recipe per page id', async () => {
			const row = cookbookRow(cookbookStructure('Dal', ['red lentil']), 42);
			await catalog.upsert(row);
			await catalog.upsert({ ...row, revisionId: 2 });
			expect(await catalog.count()).toBe(1);
		});

		it('stores the new revision of a page', async () => {
			const row = cookbookRow(cookbookStructure('Dal', ['red lentil']), 42);
			await catalog.upsert(row);
			await catalog.upsert({ ...row, revisionId: 2 });
			expect((await catalog.findByPageId(42))?.revisionId).toBe(2);
		});

		it('reads the structured recipe back', async () => {
			const stored = await add('Dal', ['red lentil', 'onion']);
			expect((await catalog.findById(stored.id))?.recipe.ingredients[1].name).toBe('onion');
		});
	});

	describe('search', () => {
		it('ranks by similarity to the embedding', async () => {
			await add('Apple pie', ['apple'], {}, axis(1));
			const soup = await add('Leek soup', ['leek'], {}, axis(2));
			const [first] = await catalog.search({ ...filter, text: null, embedding: axis(2) });
			expect(first.id).toBe(soup.id);
		});

		it('leaves out recipes without an embedding when ranking by one', async () => {
			await add('Apple pie', ['apple']);
			expect(await catalog.search({ ...filter, text: null, embedding: axis(2) })).toEqual([]);
		});

		it('finds words in an ingredient', async () => {
			await add('Winter soup', ['leek', 'potato']);
			await add('Apple pie', ['apple']);
			const found = await catalog.search({ ...filter, text: 'leek', embedding: null });
			expect(found.map((recipe) => recipe.title)).toEqual(['Winter soup']);
		});
	});

	describe('sample', () => {
		const sample = { ...filter, wanted: [], preferTags: [], seed: 'household:1' };

		it('keeps recipes with one tag of each group', async () => {
			await add('Roast chicken', ['chicken']);
			await add('Dal', ['red lentil']);
			const found = await catalog.sample({ ...sample, tagGroups: [['vegetarian', 'vegan']] });
			expect(found.map((recipe) => recipe.title)).toEqual(['Dal']);
		});

		it('leaves out a recipe with an allergen in an ingredient', async () => {
			await add('Satay', ['peanut butter', 'chicken']);
			expect(await catalog.sample({ ...sample, avoid: ['peanut'] })).toEqual([]);
		});

		it('puts recipes using wanted items first', async () => {
			await add('Apple pie', ['apple', 'flour']);
			const soup = await add('Leek soup', ['leek', 'potato']);
			const [first] = await catalog.sample({ ...sample, wanted: ['leek', 'potato'] });
			expect(first.id).toBe(soup.id);
		});

		it('puts recipes with a preferred tag next', async () => {
			await add('Lemonade', ['lemon', 'sugar'], { tags: [] });
			const stew = await add('Bean stew', ['bean', 'onion'], { tags: ['main'] });
			const [first] = await catalog.sample({ ...sample, preferTags: ['main'] });
			expect(first.id).toBe(stew.id);
		});

		it('leaves out a recipe the household adopted', async () => {
			const dal = await add('Dal', ['red lentil']);
			await service.adopt(actor, dal.id);
			expect(await catalog.sample({ ...sample, householdId: actor.householdId })).toEqual([]);
		});
	});

	describe('adoption', () => {
		it('returns the same household copy when adopted twice', async () => {
			const dal = await add('Dal', ['red lentil']);
			const first = await service.adopt(actor, dal.id);
			expect((await service.adopt(actor, dal.id)).id).toBe(first.id);
		});

		it('refuses a second copy in the same household', async () => {
			const dal = await add('Dal', ['red lentil']);
			await service.adopt(actor, dal.id);
			await expect(
				recipes.create({
					userId: actor.userId,
					householdId: actor.householdId,
					title: 'Dal',
					instructions: 'Cook.',
					cookbookRecipeId: dal.id
				})
			).rejects.toThrow();
		});
	});

	describe('pictures', () => {
		it('lists a recipe without a picture', async () => {
			const dal = await add('Dal', ['red lentil']);
			expect((await catalog.findWithoutPicture(10, false)).map((recipe) => recipe.id)).toEqual([
				dal.id
			]);
		});

		it('counts a seed stand-in as without a picture when asked', async () => {
			const dal = await add('Dal', ['red lentil']);
			await catalog.updatePicture(dal.id, { imageUrl: '/seed/x.webp', imageSource: 'COMMONS' });
			expect(await catalog.countWithoutPicture(true)).toBe(1);
		});

		it('does not count a stand-in otherwise', async () => {
			const dal = await add('Dal', ['red lentil']);
			await catalog.updatePicture(dal.id, { imageUrl: '/seed/x.webp', imageSource: 'COMMONS' });
			expect(await catalog.countWithoutPicture(false)).toBe(0);
		});

		it('keeps the picture style in the recipe', async () => {
			const dal = await add('Dal', ['red lentil']);
			await catalog.updatePicture(dal.id, { imageUrl: '/r/dal.png', pictureStyle: 2 });
			expect((await catalog.findById(dal.id))?.recipe.pictureStyle).toBe(2);
		});

		it('keeps the rest of the recipe when it stores the style', async () => {
			const dal = await add('Dal', ['red lentil']);
			await catalog.updatePicture(dal.id, { imageUrl: '/r/dal.png', pictureStyle: 2 });
			expect((await catalog.findById(dal.id))?.recipe.ingredients[0].name).toBe('red lentil');
		});

		it('keeps the picture caption in the recipe', async () => {
			const dal = await add('Dal', ['red lentil']);
			await catalog.updatePictureCaption(dal.id, "A bowl of dal, cook's choice.");
			expect((await catalog.findById(dal.id))?.recipe.pictureCaption).toBe(
				"A bowl of dal, cook's choice."
			);
		});

		it('lists pictures of an older style, and those without one, for a regenerate run', async () => {
			const old = await add('Dal', ['red lentil']);
			await catalog.updatePicture(old.id, { imageUrl: '/r/old.png' });
			const current = await add('Chili', ['bean']);
			await catalog.updatePicture(current.id, { imageUrl: '/r/new.png', pictureStyle: 2 });
			const none = await add('Soup', ['leek']);
			expect((await catalog.findWithOlderPicture(10, 2)).map((recipe) => recipe.id)).toEqual([
				old.id,
				none.id
			]);
		});

		it('counts pictures of an older style', async () => {
			const old = await add('Dal', ['red lentil']);
			await catalog.updatePicture(old.id, { imageUrl: '/r/old.png', pictureStyle: 1 });
			expect(await catalog.countWithOlderPicture(2)).toBe(1);
		});
	});
});
