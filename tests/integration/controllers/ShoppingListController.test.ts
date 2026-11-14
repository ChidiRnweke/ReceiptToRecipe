import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingListController } from '../../../src/lib/controllers/ShoppingListController';
import {
	MockShoppingListRepository,
	MockShoppingListItemRepository
} from '../../mocks/MockShoppingListRepositories';
import {
	MockRecipeIngredientRepository,
	MockRecipeRepository
} from '../../mocks/MockRecipeRepositories';
import {
	MockReceiptItemRepository,
	MockReceiptRepository
} from '../../mocks/MockReceiptRepositories';
import type { Actor } from '../../../src/lib/models/household';

describe('ShoppingListController', () => {
	let controller: ShoppingListController;
	let listRepo: MockShoppingListRepository;
	let itemRepo: MockShoppingListItemRepository;
	let recipeIngredientRepo: MockRecipeIngredientRepository;
	let receiptItemRepo: MockReceiptItemRepository;
	let recipeRepo: MockRecipeRepository;
	let receiptRepo: MockReceiptRepository;

	const userId = 'user-123';
	const householdId = 'household-1';
	const otherHouseholdId = 'household-2';
	const actor: Actor = {
		userId,
		householdId,
		memberId: 'member-1',
		displayName: 'Test',
		roles: { plans: true, shops: true, cooks: true },
		timeZone: 'UTC'
	};
	const housemate: Actor = {
		userId: 'user-789',
		householdId,
		memberId: 'member-2',
		displayName: 'Housemate',
		roles: { plans: true, shops: true, cooks: true },
		timeZone: 'UTC'
	};

	async function createRecipe(owner: { userId: string; householdId: string } = actor) {
		return recipeRepo.create({
			userId: owner.userId,
			householdId: owner.householdId,
			title: 'Test recipe',
			instructions: 'Cook.'
		});
	}

	async function createReceipt(owner: { userId: string; householdId: string } = actor) {
		return receiptRepo.create({
			userId: owner.userId,
			householdId: owner.householdId,
			imageUrl: 'https://example.com/receipt.jpg'
		});
	}

	beforeEach(() => {
		listRepo = new MockShoppingListRepository();
		itemRepo = new MockShoppingListItemRepository();
		recipeIngredientRepo = new MockRecipeIngredientRepository();
		receiptItemRepo = new MockReceiptItemRepository();
		recipeRepo = new MockRecipeRepository();
		receiptRepo = new MockReceiptRepository();

		// Wire the item repo into the list repo so findByIdWithItems works
		listRepo.setItemRepository(itemRepo);

		controller = new ShoppingListController(
			listRepo,
			itemRepo,
			recipeIngredientRepo,
			receiptItemRepo,
			recipeRepo,
			receiptRepo
		);
	});

	describe('getActiveList', () => {
		it('should create a new list when none exists', async () => {
			const result = await controller.getActiveList(actor);

			expect(result.userId).toBe(userId);
			expect(result.name).toBe('Shopping List');
			expect(result.isActive).toBe(true);
			expect(result.items).toEqual([]);
		});

		it('should return existing active list', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'My List',
				isActive: true
			});

			const result = await controller.getActiveList(actor);

			expect(result.id).toBe(list.id);
			expect(result.name).toBe('My List');
		});

		it('should not return inactive lists', async () => {
			await listRepo.create({ userId, householdId, name: 'Old List', isActive: false });

			const result = await controller.getActiveList(actor);

			// Should create a new one since none is active
			expect(result.name).toBe('Shopping List');
			expect(result.isActive).toBe(true);
		});

		it('should return list with its items', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'My List',
				isActive: true
			});
			await itemRepo.create({
				shoppingListId: list.id,
				name: 'Milk',
				quantity: '1',
				unit: 'gallon',
				orderIndex: 0
			});

			const result = await controller.getActiveList(actor);

			expect(result.items.length).toBe(1);
			expect(result.items[0].name).toBe('Milk');
		});
	});

	describe('household sharing', () => {
		it('shows a second member of the household the same active list', async () => {
			const list = await controller.getActiveList(actor);

			const seenByHousemate = await controller.getActiveList(housemate);

			expect(seenByHousemate.id).toBe(list.id);
		});

		it("lets a second member of the household add to the household's list", async () => {
			const list = await controller.getActiveList(actor);

			const item = await controller.addItem(housemate, list.id, { name: 'Bread' });

			expect(item.shoppingListId).toBe(list.id);
		});
	});

	describe('addItem', () => {
		it('should add an item to the list', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});

			const item = await controller.addItem(actor, list.id, { name: 'Eggs' });

			expect(item.name).toBe('Eggs');
			expect(item.shoppingListId).toBe(list.id);
			expect(item.orderIndex).toBe(0);
		});

		it('should auto-increment order index', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});

			const item1 = await controller.addItem(actor, list.id, { name: 'Eggs' });
			const item2 = await controller.addItem(actor, list.id, {
				name: 'Bread'
			});
			const item3 = await controller.addItem(actor, list.id, { name: 'Milk' });

			expect(item1.orderIndex).toBe(0);
			expect(item2.orderIndex).toBe(1);
			expect(item3.orderIndex).toBe(2);
		});

		it('should set optional fields when provided', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});

			const item = await controller.addItem(actor, list.id, {
				name: 'Chicken',
				quantity: '2',
				unit: 'lbs',
				fromRecipeId: 'recipe-1',
				notes: 'organic'
			});

			expect(item.quantity).toBe('2');
			expect(item.unit).toBe('lbs');
			expect(item.fromRecipeId).toBe('recipe-1');
			expect(item.notes).toBe('organic');
		});

		it('should default checked to false', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});
			const item = await controller.addItem(actor, list.id, { name: 'Sugar' });
			expect(item.checked).toBe(false);
		});
	});

	describe('addRecipeIngredients', () => {
		it('should add all ingredients from a recipe', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});
			const recipeId = (await createRecipe()).id;

			await recipeIngredientRepo.createMany([
				{
					recipeId,
					name: 'Flour',
					quantity: '2',
					unit: 'cups',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 0
				},
				{
					recipeId,
					name: 'Sugar',
					quantity: '1',
					unit: 'cup',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 1
				},
				{
					recipeId,
					name: 'Butter',
					quantity: '100',
					unit: 'g',
					unitType: 'WEIGHT',
					optional: false,
					orderIndex: 2
				}
			]);

			const items = await controller.addRecipeIngredients(actor, list.id, recipeId);

			expect(items.length).toBe(3);
			expect(items[0].name).toBe('Flour');
			expect(items[0].fromRecipeId).toBe(recipeId);
			expect(items[1].name).toBe('Sugar');
			expect(items[2].name).toBe('Butter');
		});

		it('should exclude items in pantry when excludeInStock is true', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});
			const recipeId = (await createRecipe()).id;

			await recipeIngredientRepo.createMany([
				{
					recipeId,
					name: 'Flour',
					quantity: '2',
					unit: 'cups',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 0
				},
				{
					recipeId,
					name: 'Sugar',
					quantity: '1',
					unit: 'cup',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 1
				},
				{
					recipeId,
					name: 'Eggs',
					quantity: '2',
					unit: 'count',
					unitType: 'COUNT',
					optional: false,
					orderIndex: 2
				}
			]);

			const items = await controller.addRecipeIngredients(
				actor,
				list.id,
				recipeId,
				true,
				['flour', 'eggs'] // These are in stock
			);

			expect(items.length).toBe(1);
			expect(items[0].name).toBe('Sugar');
		});

		it('should add all when excludeInStock is false', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});
			const recipeId = (await createRecipe()).id;

			await recipeIngredientRepo.createMany([
				{
					recipeId,
					name: 'Flour',
					quantity: '2',
					unit: 'cups',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 0
				},
				{
					recipeId,
					name: 'Sugar',
					quantity: '1',
					unit: 'cup',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 1
				}
			]);

			const items = await controller.addRecipeIngredients(actor, list.id, recipeId, false, [
				'flour'
			]);

			expect(items.length).toBe(2);
		});

		it('should return empty array when recipe has no ingredients', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});

			const recipe = await createRecipe();

			const items = await controller.addRecipeIngredients(actor, list.id, recipe.id);

			expect(items).toEqual([]);
		});

		it('rejects a recipe that does not exist', async () => {
			const list = await listRepo.create({ userId, householdId, name: 'Test', isActive: true });

			await expect(
				controller.addRecipeIngredients(actor, list.id, 'nonexistent-recipe')
			).rejects.toThrow('Recipe not found');
		});

		it("rejects another household's private recipe", async () => {
			const list = await listRepo.create({ userId, householdId, name: 'Test', isActive: true });
			const recipe = await createRecipe({ userId: 'other-user', householdId: otherHouseholdId });

			await expect(controller.addRecipeIngredients(actor, list.id, recipe.id)).rejects.toThrow(
				'Recipe not found'
			);
		});

		it("adds ingredients from another household's public recipe", async () => {
			const list = await listRepo.create({ userId, householdId, name: 'Test', isActive: true });
			const recipe = await createRecipe({ userId: 'other-user', householdId: otherHouseholdId });
			await recipeRepo.togglePublic(recipe.id);
			await recipeIngredientRepo.createMany([
				{
					recipeId: recipe.id,
					name: 'Basil',
					quantity: '1',
					unit: 'bunch',
					unitType: 'COUNT',
					optional: false,
					orderIndex: 0
				}
			]);

			const items = await controller.addRecipeIngredients(actor, list.id, recipe.id);

			expect(items.map((item) => item.name)).toEqual(['Basil']);
		});
	});

	describe('addReceiptItems', () => {
		it('should add all receipt items to the shopping list', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});
			const receiptId = (await createReceipt()).id;

			await receiptItemRepo.create({
				receiptId,
				rawName: 'Organic Milk',
				normalizedName: 'milk',
				quantity: '1',
				unit: 'gallon',
				unitType: 'VOLUME'
			});
			await receiptItemRepo.create({
				receiptId,
				rawName: 'Brown Eggs 12ct',
				normalizedName: 'eggs',
				quantity: '12',
				unit: 'count',
				unitType: 'COUNT'
			});

			const items = await controller.addReceiptItems(actor, list.id, receiptId);

			expect(items.length).toBe(2);
			expect(items[0].name).toBe('milk');
			expect(items[0].quantity).toBe('1');
			expect(items[0].unit).toBe('gallon');
			expect(items[1].name).toBe('eggs');
		});

		it('should return empty array when receipt has no items', async () => {
			const list = await listRepo.create({
				userId,
				householdId,
				name: 'Test',
				isActive: true
			});

			const receipt = await createReceipt();

			const items = await controller.addReceiptItems(actor, list.id, receipt.id);

			expect(items).toEqual([]);
		});

		it("rejects another household's receipt", async () => {
			const list = await listRepo.create({ userId, householdId, name: 'Test', isActive: true });
			const receipt = await createReceipt({ userId: 'other-user', householdId: otherHouseholdId });

			await expect(controller.addReceiptItems(actor, list.id, receipt.id)).rejects.toThrow(
				'Receipt not found'
			);
		});
	});

	describe('authorization checks', () => {
		const otherUserId = 'other-user';

		it('should prevent adding item to another user list', async () => {
			const list = await listRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				name: 'Other',
				isActive: true
			});
			await expect(controller.addItem(actor, list.id, { name: 'Milk' })).rejects.toThrow(
				'Unauthorized access to shopping list'
			);
		});
	});
});
