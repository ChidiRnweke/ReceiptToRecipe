import { describe, it, expect, beforeEach } from 'vitest';
import { RecipesDoorController } from '../../../src/lib/controllers/RecipesDoorController';
import { RecipeBookService } from '../../../src/lib/services/RecipeBookService';
import type { Actor } from '../../../src/lib/models/household';
import type { NewKitchenEvent } from '../../../src/lib/models/kitchen';
import {
	MockImageGenerator,
	MockJobQueue,
	MockSavedRecipeRepository,
	MockStorageService,
	MockTasteProfileService,
	MockUserPreferencesRepository
} from '../../mocks';
import { createKitchen } from '../../fakes/kitchen';
import { InMemoryRecipeStepRepository } from '../../fakes/InMemoryRecipeStepRepository';
import { RecordingCulinaryIntelligence } from '../../fakes/RecordingCulinaryIntelligence';
import { at } from '../../helpers/kitchenEvents';

const actor: Actor = {
	userId: 'user-1',
	householdId: 'household-1',
	memberId: 'member-1',
	displayName: 'Noor',
	roles: { plans: true, shops: true, cooks: true },
	timeZone: 'UTC'
};

const photo = {
	bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
	name: 'orzo.jpg',
	mimeType: 'image/jpeg'
};

describe('RecipesDoorController', () => {
	let culinary: RecordingCulinaryIntelligence;
	let storage: MockStorageService;
	let kitchen: ReturnType<typeof createKitchen>;
	let steps: InMemoryRecipeStepRepository;
	let controller: RecipesDoorController;

	beforeEach(() => {
		culinary = new RecordingCulinaryIntelligence();
		storage = new MockStorageService();
		kitchen = createKitchen();
		steps = new InMemoryRecipeStepRepository();
		const book = new RecipeBookService(
			kitchen.recipes,
			kitchen.ingredients,
			steps,
			new MockImageGenerator(),
			new MockJobQueue(false)
		);
		controller = new RecipesDoorController(
			culinary,
			storage,
			kitchen.service,
			new MockTasteProfileService(),
			book,
			new MockUserPreferencesRepository(),
			kitchen.recipes,
			new MockSavedRecipeRepository(),
			kitchen.mealLogs,
			() => at(1, 18)
		);
	});

	function event(overrides: Partial<NewKitchenEvent> & Pick<NewKitchenEvent, 'kind'>) {
		return kitchen.events.append({
			householdId: actor.householdId,
			actorUserId: actor.userId,
			occurredAt: at(0),
			...overrides
		});
	}

	async function recipe(source: 'GENERATED' | 'RAG' | 'USER' | 'SNAPPED', title: string = source) {
		return kitchen.recipes.create({
			userId: actor.userId,
			householdId: actor.householdId,
			title,
			instructions: 'Serve.',
			source
		});
	}

	describe('craving', () => {
		it('offers the model what the kitchen holds', async () => {
			await event({
				kind: 'BOUGHT',
				itemKey: 'baby spinach',
				quantity: 200,
				unit: 'g',
				payload: { category: 'produce' }
			});

			await controller.craving(actor, 'Something green', []);

			expect(culinary.cravings[0].available).toEqual(['baby spinach']);
		});

		it('passes the titles already offered when asked for another one', async () => {
			await controller.craving(actor, 'Something spicy, 20 minutes', ['Chickpeas skillet']);

			expect(culinary.cravings[0].excludeTitles).toEqual(['Chickpeas skillet']);
		});

		it('saves the recipe as made up', async () => {
			const card = await controller.craving(actor, 'Quick and light', []);

			expect((await kitchen.recipes.findById(card.id))?.source).toBe('GENERATED');
		});

		it('saves the steps with their verbs', async () => {
			const card = await controller.craving(actor, 'Quick and light', []);

			expect((await steps.findByRecipeId(card.id)).map((step) => step.verb)).toEqual([
				'Sweat',
				'Sauté',
				null
			]);
		});

		it('says which ingredients the kitchen holds', async () => {
			await event({ kind: 'BOUGHT', itemKey: 'egg', quantity: 6, unit: 'count' });

			const card = await controller.craving(actor, 'Eggs, please', []);

			// The mock writes the recipe's ingredients from the stock keys, which are singular.
			expect(card.uses).toEqual(['egg']);
		});
	});

	describe('snap', () => {
		it('stores the photo', async () => {
			await controller.snap(actor, photo);

			expect(storage.getStored('recipes/orzo.jpg')).toBeDefined();
		});

		it('sends the photo to the model', async () => {
			await controller.snap(actor, photo);

			expect(culinary.photos[0].mimeType).toBe('image/jpeg');
		});

		it('saves the recipe as snapped', async () => {
			const card = await controller.snap(actor, photo);

			expect((await kitchen.recipes.findById(card.id))?.source).toBe('SNAPPED');
		});

		it('shows a cookbook page as the recipe picture', async () => {
			const card = await controller.snap(actor, photo);

			expect((await kitchen.recipes.findById(card.id))?.imageUrl).toBe('mock://recipes/orzo.jpg');
		});

		it('does not show a screenshot as the recipe picture', async () => {
			culinary.snapKind = 'screenshot';

			const card = await controller.snap(actor, photo);

			expect((await kitchen.recipes.findById(card.id))?.imageUrl).toBeNull();
		});

		it('forgets the photo when it holds no recipe', async () => {
			culinary.snapKind = 'none';

			await controller.snap(actor, photo).catch(() => undefined);

			expect(storage.getStored('recipes/orzo.jpg')).toBeUndefined();
		});
	});

	describe('listMine', () => {
		it('lists cooked recipes on the Made tab, newest first', async () => {
			const curry = await recipe('USER', 'Curry');
			const dal = await recipe('USER', 'Dal');
			await event({ kind: 'COOKED', recipeId: curry.id, occurredAt: at(0, 19) });
			await event({ kind: 'COOKED', recipeId: dal.id, occurredAt: at(1, 19) });

			const mine = await controller.listMine(actor, 'made');

			expect(mine.rows.map((row) => row.title)).toEqual(['Dal', 'Curry']);
		});

		it('dates a Made row by its last cooking', async () => {
			const curry = await recipe('USER', 'Curry');
			await event({ kind: 'COOKED', recipeId: curry.id, occurredAt: at(0, 19) });
			await event({ kind: 'COOKED', recipeId: curry.id, occurredAt: at(1, 19) });

			const mine = await controller.listMine(actor, 'made');

			expect(mine.rows.map((row) => row.madeAt)).toEqual([at(1, 19)]);
		});

		it('lists a recipe the person logged eating as made', async () => {
			const curry = await recipe('USER', 'Curry');
			await kitchen.mealLogs.create({
				userId: actor.userId,
				recipeId: curry.id,
				foodName: 'Curry',
				calories: 500,
				mealType: 'DINNER',
				consumedAt: at(0, 19)
			});

			const mine = await controller.listMine(actor, 'made');

			expect(mine.rows.map((row) => row.title)).toEqual(['Curry']);
		});

		it('keeps cookbook and hand-written recipes off the Added tab', async () => {
			await recipe('GENERATED');
			await recipe('SNAPPED');
			await recipe('RAG');
			await recipe('USER');

			const mine = await controller.listMine(actor, 'added');

			expect(mine.rows.map((row) => row.source).sort()).toEqual(['GENERATED', 'SNAPPED']);
		});

		it('counts every tab', async () => {
			await recipe('GENERATED');
			await recipe('RAG');

			const mine = await controller.listMine(actor, 'all');

			expect(mine.counts).toEqual({ made: 0, saved: 0, added: 1, all: 2 });
		});
	});
});
