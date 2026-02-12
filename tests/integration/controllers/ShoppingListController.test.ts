import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingListController } from '../../../src/lib/controllers/ShoppingListController';
import { MockShoppingListRepository, MockShoppingListItemRepository } from '../../mocks/MockShoppingListRepositories';
import { MockPurchaseHistoryRepository } from '../../mocks/MockPurchaseHistoryRepository';
import { MockRecipeIngredientRepository } from '../../mocks/MockRecipeRepositories';
import { MockReceiptItemRepository } from '../../mocks/MockReceiptRepositories';
import { MockCulinaryIntelligence } from '../../mocks/MockCulinaryIntelligence';

describe('ShoppingListController', () => {
	let controller: ShoppingListController;
	let listRepo: MockShoppingListRepository;
	let itemRepo: MockShoppingListItemRepository;
	let purchaseHistoryRepo: MockPurchaseHistoryRepository;
	let recipeIngredientRepo: MockRecipeIngredientRepository;
	let receiptItemRepo: MockReceiptItemRepository;

	const userId = 'user-123';

	beforeEach(() => {
		listRepo = new MockShoppingListRepository();
		itemRepo = new MockShoppingListItemRepository();
		purchaseHistoryRepo = new MockPurchaseHistoryRepository();
		recipeIngredientRepo = new MockRecipeIngredientRepository();
		receiptItemRepo = new MockReceiptItemRepository();

		// Wire the item repo into the list repo so findByIdWithItems works
		listRepo.setItemRepository(itemRepo);

		controller = new ShoppingListController(
			listRepo,
			itemRepo,
			purchaseHistoryRepo,
			recipeIngredientRepo,
			receiptItemRepo
		);
	});

	describe('getActiveList', () => {
		it('should create a new list when none exists', async () => {
			const result = await controller.getActiveList(userId);

			expect(result.userId).toBe(userId);
			expect(result.name).toBe('Shopping List');
			expect(result.isActive).toBe(true);
			expect(result.items).toEqual([]);
		});

		it('should return existing active list', async () => {
			const list = await listRepo.create({ userId, name: 'My List', isActive: true });

			const result = await controller.getActiveList(userId);

			expect(result.id).toBe(list.id);
			expect(result.name).toBe('My List');
		});

		it('should not return inactive lists', async () => {
			await listRepo.create({ userId, name: 'Old List', isActive: false });

			const result = await controller.getActiveList(userId);

			// Should create a new one since none is active
			expect(result.name).toBe('Shopping List');
			expect(result.isActive).toBe(true);
		});

		it('should return list with its items', async () => {
			const list = await listRepo.create({ userId, name: 'My List', isActive: true });
			await itemRepo.create({
				shoppingListId: list.id,
				name: 'Milk',
				quantity: '1',
				unit: 'gallon',
				orderIndex: 0
			});

			const result = await controller.getActiveList(userId);

			expect(result.items.length).toBe(1);
			expect(result.items[0].name).toBe('Milk');
		});
	});

	describe('getUserLists', () => {
		it('should return empty array when no lists', async () => {
			const result = await controller.getUserLists(userId);
			expect(result).toEqual([]);
		});

		it('should return all lists for user', async () => {
			await listRepo.create({ userId, name: 'List 1' });
			await listRepo.create({ userId, name: 'List 2' });

			const result = await controller.getUserLists(userId);

			expect(result.length).toBe(2);
		});

		it('should not return lists from other users', async () => {
			await listRepo.create({ userId, name: 'My List' });
			await listRepo.create({ userId: 'other-user', name: 'Other List' });

			const result = await controller.getUserLists(userId);

			expect(result.length).toBe(1);
			expect(result[0].name).toBe('My List');
		});
	});

	describe('createList', () => {
		it('should create a new active list', async () => {
			const result = await controller.createList(userId, 'Groceries');

			expect(result.userId).toBe(userId);
			expect(result.name).toBe('Groceries');
			expect(result.isActive).toBe(true);
		});

		it('should deactivate existing lists when creating a new one', async () => {
			const old = await controller.createList(userId, 'Old List');
			expect(old.isActive).toBe(true);

			await controller.createList(userId, 'New List');

			const oldStored = listRepo.getStored(old.id);
			expect(oldStored!.isActive).toBe(false);
		});
	});

	describe('addItem', () => {
		it('should add an item to the list', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const item = await controller.addItem(userId, list.id, { name: 'Eggs' });

			expect(item.name).toBe('Eggs');
			expect(item.shoppingListId).toBe(list.id);
			expect(item.orderIndex).toBe(0);
		});

		it('should auto-increment order index', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const item1 = await controller.addItem(userId, list.id, { name: 'Eggs' });
			const item2 = await controller.addItem(userId, list.id, { name: 'Bread' });
			const item3 = await controller.addItem(userId, list.id, { name: 'Milk' });

			expect(item1.orderIndex).toBe(0);
			expect(item2.orderIndex).toBe(1);
			expect(item3.orderIndex).toBe(2);
		});

		it('should set optional fields when provided', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const item = await controller.addItem(userId, list.id, {
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
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Sugar' });
			expect(item.checked).toBe(false);
		});
	});

	describe('addRecipeIngredients', () => {
		it('should add all ingredients from a recipe', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const recipeId = 'recipe-1';

			await recipeIngredientRepo.createMany([
				{ recipeId, name: 'Flour', quantity: '2', unit: 'cups', unitType: 'VOLUME', optional: false, orderIndex: 0 },
				{ recipeId, name: 'Sugar', quantity: '1', unit: 'cup', unitType: 'VOLUME', optional: false, orderIndex: 1 },
				{ recipeId, name: 'Butter', quantity: '100', unit: 'g', unitType: 'WEIGHT', optional: false, orderIndex: 2 }
			]);

			const items = await controller.addRecipeIngredients(userId, list.id, recipeId);

			expect(items.length).toBe(3);
			expect(items[0].name).toBe('Flour');
			expect(items[0].fromRecipeId).toBe(recipeId);
			expect(items[1].name).toBe('Sugar');
			expect(items[2].name).toBe('Butter');
		});

		it('should exclude items in pantry when excludeInStock is true', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const recipeId = 'recipe-2';

			await recipeIngredientRepo.createMany([
				{ recipeId, name: 'Flour', quantity: '2', unit: 'cups', unitType: 'VOLUME', optional: false, orderIndex: 0 },
				{ recipeId, name: 'Sugar', quantity: '1', unit: 'cup', unitType: 'VOLUME', optional: false, orderIndex: 1 },
				{ recipeId, name: 'Eggs', quantity: '2', unit: 'count', unitType: 'COUNT', optional: false, orderIndex: 2 }
			]);

			const items = await controller.addRecipeIngredients(
				userId,
				list.id,
				recipeId,
				true,
				['flour', 'eggs'] // These are in stock
			);

			expect(items.length).toBe(1);
			expect(items[0].name).toBe('Sugar');
		});

		it('should add all when excludeInStock is false', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const recipeId = 'recipe-3';

			await recipeIngredientRepo.createMany([
				{ recipeId, name: 'Flour', quantity: '2', unit: 'cups', unitType: 'VOLUME', optional: false, orderIndex: 0 },
				{ recipeId, name: 'Sugar', quantity: '1', unit: 'cup', unitType: 'VOLUME', optional: false, orderIndex: 1 }
			]);

			const items = await controller.addRecipeIngredients(
				userId,
				list.id,
				recipeId,
				false,
				['flour']
			);

			expect(items.length).toBe(2);
		});

		it('should return empty array when recipe has no ingredients', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const items = await controller.addRecipeIngredients(userId, list.id, 'nonexistent-recipe');

			expect(items).toEqual([]);
		});
	});

	describe('addReceiptItems', () => {
		it('should add all receipt items to the shopping list', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const receiptId = 'receipt-1';

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

			const items = await controller.addReceiptItems(userId, list.id, receiptId);

			expect(items.length).toBe(2);
			expect(items[0].name).toBe('milk');
			expect(items[0].quantity).toBe('1');
			expect(items[0].unit).toBe('gallon');
			expect(items[1].name).toBe('eggs');
		});

		it('should return empty array when receipt has no items', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const items = await controller.addReceiptItems(userId, list.id, 'empty-receipt');

			expect(items).toEqual([]);
		});
	});

	describe('toggleItem', () => {
		it('should toggle item from unchecked to checked', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });

			expect(item.checked).toBe(false);

			const toggled = await controller.toggleItem(userId, item.id);
			expect(toggled.checked).toBe(true);
		});

		it('should toggle item from checked to unchecked', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });

			await controller.toggleItem(userId, item.id); // check
			const toggled = await controller.toggleItem(userId, item.id); // uncheck
			expect(toggled.checked).toBe(false);
		});

		it('should set explicit checked value when provided', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });

			const result = await controller.toggleItem(userId, item.id, true);
			expect(result.checked).toBe(true);

			const result2 = await controller.toggleItem(userId, item.id, true);
			expect(result2.checked).toBe(true); // Still true, not toggled
		});

		it('should throw when item not found', async () => {
			await expect(controller.toggleItem(userId, 'nonexistent')).rejects.toThrow('Item not found');
		});
	});

	describe('removeItem', () => {
		it('should remove an item from the list', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });

			await controller.removeItem(userId, item.id);

			const remaining = await itemRepo.findByListId(list.id);
			expect(remaining.length).toBe(0);
		});
	});

	describe('clearCheckedItems', () => {
		it('should remove only checked items', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item1 = await controller.addItem(userId, list.id, { name: 'Milk' });
			const item2 = await controller.addItem(userId, list.id, { name: 'Bread' });
			const item3 = await controller.addItem(userId, list.id, { name: 'Eggs' });

			await controller.toggleItem(userId, item1.id, true);
			await controller.toggleItem(userId, item3.id, true);

			await controller.clearCheckedItems(userId, list.id);

			const remaining = await itemRepo.findByListId(list.id);
			expect(remaining.length).toBe(1);
			expect(remaining[0].name).toBe('Bread');
		});

		it('should do nothing when no items are checked', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			await controller.addItem(userId, list.id, { name: 'Milk' });

			await controller.clearCheckedItems(userId, list.id);

			const remaining = await itemRepo.findByListId(list.id);
			expect(remaining.length).toBe(1);
		});
	});

	describe('completeShopping', () => {
		it('should create purchase history for checked items', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk', quantity: '1' });
			await controller.toggleItem(userId, item.id, true);

			await controller.completeShopping(userId, list.id);

			const history = await purchaseHistoryRepo.findByUserId(userId);
			expect(history.length).toBe(1);
			expect(history[0].itemName).toBe('Milk');
			expect(history[0].purchaseCount).toBe(1);
			expect(history[0].avgQuantity).toBe('1');
		});

		it('should update existing purchase history', async () => {
			// Create initial purchase history
			const existing = await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
				purchaseCount: 3,
				avgFrequencyDays: 7
			});

			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });
			await controller.toggleItem(userId, item.id, true);

			await controller.completeShopping(userId, list.id);

			const updated = await purchaseHistoryRepo.findById(existing.id);
			expect(updated!.purchaseCount).toBe(4);
			expect(updated!.lastPurchased.getTime()).toBeGreaterThan(existing.lastPurchased.getTime());
		});

		it('should clear checked items after completing', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item1 = await controller.addItem(userId, list.id, { name: 'Milk' });
			const item2 = await controller.addItem(userId, list.id, { name: 'Bread' });
			await controller.toggleItem(userId, item1.id, true);

			await controller.completeShopping(userId, list.id);

			const remaining = await itemRepo.findByListId(list.id);
			expect(remaining.length).toBe(1);
			expect(remaining[0].name).toBe('Bread');
		});

		it('should do nothing when no items are checked', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			await controller.addItem(userId, list.id, { name: 'Milk' });

			await controller.completeShopping(userId, list.id);

			const history = await purchaseHistoryRepo.findByUserId(userId);
			expect(history.length).toBe(0);
		});

		it('should calculate average frequency when updating existing history', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
				purchaseCount: 2,
				avgFrequencyDays: 14
			});

			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item = await controller.addItem(userId, list.id, { name: 'Milk' });
			await controller.toggleItem(userId, item.id, true);

			await controller.completeShopping(userId, list.id);

			const history = await purchaseHistoryRepo.findByUserAndItem(userId, 'Milk');
			// New frequency = Math.round((14 + 10) / 2) = 12
			expect(history!.avgFrequencyDays).toBe(12);
		});
	});

	describe('getSmartSuggestions', () => {
		it('should return suggestions for items due for repurchase', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
				purchaseCount: 5,
				avgFrequencyDays: 7,
				avgQuantity: '1'
			});

			const suggestions = await controller.getSmartSuggestions(userId);

			expect(suggestions.length).toBe(1);
			expect(suggestions[0].itemName).toBe('Milk');
		});

		it('should not suggest items not yet due', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Flour',
				lastPurchased: new Date(), // just now
				purchaseCount: 3,
				avgFrequencyDays: 30,
				avgQuantity: '2'
			});

			const suggestions = await controller.getSmartSuggestions(userId);
			expect(suggestions.length).toBe(0);
		});

		it('should respect limit parameter', async () => {
			for (let i = 0; i < 5; i++) {
				await purchaseHistoryRepo.create({
					userId,
					itemName: `Item ${i}`,
					lastPurchased: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
					purchaseCount: 3,
					avgFrequencyDays: 7,
					avgQuantity: '1'
				});
			}

			const suggestions = await controller.getSmartSuggestions(userId, 3);
			expect(suggestions.length).toBe(3);
		});

		it('should return empty array when no purchase history', async () => {
			const suggestions = await controller.getSmartSuggestions(userId);
			expect(suggestions).toEqual([]);
		});
	});

	describe('addSuggestion', () => {
		it('should add a suggestion as a shopping list item', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const item = await controller.addSuggestion(userId, list.id, {
				itemName: 'Milk',
				lastPurchased: new Date(),
				avgFrequencyDays: 7,
				daysSinceLastPurchase: 8,
				suggestedQuantity: '2'
			});

			expect(item.name).toBe('Milk');
			expect(item.quantity).toBe('2');
			expect(item.notes).toContain('7 day purchase cycle');
		});

		it('should handle null suggested quantity', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			const item = await controller.addSuggestion(userId, list.id, {
				itemName: 'Salt',
				lastPurchased: new Date(),
				avgFrequencyDays: 90,
				daysSinceLastPurchase: 100,
				suggestedQuantity: null
			});

			expect(item.name).toBe('Salt');
			expect(item.quantity).toBeNull(); // no quantity provided
		});
	});

	describe('createRestockList', () => {
		it('should throw when no purchase history exists', async () => {
			const culinaryIntelligence = new MockCulinaryIntelligence();

			await expect(
				controller.createRestockList(userId, culinaryIntelligence)
			).rejects.toThrow('No purchase history yet');
		});

		it('should create a restock list using AI decisions', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
				purchaseCount: 5,
				avgFrequencyDays: 7,
				avgQuantity: '1'
			});
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Bread',
				lastPurchased: new Date(),
				purchaseCount: 3,
				avgFrequencyDays: 5,
				avgQuantity: '1'
			});

			const culinaryIntelligence = new MockCulinaryIntelligence();
			// Mock the chat response to return a valid JSON array
			// The chat method uses message content concatenated with | as key
			// We can't predict the exact key, so set a default response
			// Override the chat method to always return our restock decisions
			const originalChat = culinaryIntelligence.chat.bind(culinaryIntelligence);
			culinaryIntelligence.chat = async () => {
				return JSON.stringify([
					{ itemName: 'Milk', restock: true, quantity: '2', note: 'Running low' },
					{ itemName: 'Bread', restock: false, quantity: '1', note: 'Still fresh' }
				]);
			};

			const result = await controller.createRestockList(userId, culinaryIntelligence);

			expect(result.name).toContain('Restock');
			expect(result.items.length).toBe(1); // Only Milk (Bread has restock: false)
			expect(result.items[0].name).toBe('Milk');
			expect(result.items[0].quantity).toBe('2');
		});

		it('should fall back to heuristic suggestions when AI fails', async () => {
			// Create items that are overdue
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
				purchaseCount: 5,
				avgFrequencyDays: 7,
				avgQuantity: '2'
			});

			const culinaryIntelligence = new MockCulinaryIntelligence();
			// Make AI throw an error
			culinaryIntelligence.chat = async () => {
				throw new Error('AI unavailable');
			};

			const result = await controller.createRestockList(userId, culinaryIntelligence);

			expect(result.name).toContain('Restock');
			// Should fall back to smart suggestions
			expect(result.items.length).toBeGreaterThanOrEqual(1);
			expect(result.items[0].name).toBe('Milk');
		});

		it('should deactivate previous lists when creating restock list', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
				purchaseCount: 5,
				avgFrequencyDays: 7,
				avgQuantity: '1'
			});

			const oldList = await listRepo.create({ userId, name: 'Old List', isActive: true });

			const culinaryIntelligence = new MockCulinaryIntelligence();
			culinaryIntelligence.chat = async () => {
				return JSON.stringify([
					{ itemName: 'Milk', restock: true, quantity: '1', note: 'Needed' }
				]);
			};

			await controller.createRestockList(userId, culinaryIntelligence);

			const oldStored = listRepo.getStored(oldList.id);
			expect(oldStored!.isActive).toBe(false);
		});
	});

	describe('reorderItems', () => {
		it('should update order indices', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });
			const item1 = await controller.addItem(userId, list.id, { name: 'A' });
			const item2 = await controller.addItem(userId, list.id, { name: 'B' });
			const item3 = await controller.addItem(userId, list.id, { name: 'C' });

			// Reverse the order
			await controller.reorderItems(userId, list.id, [item3.id, item2.id, item1.id]);

			const items = await itemRepo.findByListId(list.id);
			expect(items[0].name).toBe('C');
			expect(items[0].orderIndex).toBe(0);
			expect(items[1].name).toBe('B');
			expect(items[1].orderIndex).toBe(1);
			expect(items[2].name).toBe('A');
			expect(items[2].orderIndex).toBe(2);
		});
	});

	describe('deleteList', () => {
		it('should delete a list belonging to the user', async () => {
			const list = await listRepo.create({ userId, name: 'Test', isActive: true });

			await controller.deleteList(list.id, userId);

			const stored = listRepo.getStored(list.id);
			expect(stored).toBeUndefined();
		});

		it('should throw when list not found', async () => {
			await expect(
				controller.deleteList('nonexistent', userId)
			).rejects.toThrow('Shopping list not found');
		});

		it('should throw when list belongs to different user', async () => {
			const list = await listRepo.create({ userId: 'other-user', name: 'Other List', isActive: true });

			await expect(
				controller.deleteList(list.id, userId)
			).rejects.toThrow('Shopping list not found');
		});
	});

	describe('generateFromRecipes', () => {
		it('should create a list with ingredients from multiple recipes', async () => {
			const recipeId1 = 'recipe-a';
			const recipeId2 = 'recipe-b';

			await recipeIngredientRepo.createMany([
				{ recipeId: recipeId1, name: 'Flour', quantity: '2', unit: 'cups', unitType: 'VOLUME', optional: false, orderIndex: 0 },
				{ recipeId: recipeId1, name: 'Sugar', quantity: '1', unit: 'cup', unitType: 'VOLUME', optional: false, orderIndex: 1 }
			]);

			await recipeIngredientRepo.createMany([
				{ recipeId: recipeId2, name: 'Chicken', quantity: '500', unit: 'g', unitType: 'WEIGHT', optional: false, orderIndex: 0 },
				{ recipeId: recipeId2, name: 'Rice', quantity: '2', unit: 'cups', unitType: 'VOLUME', optional: false, orderIndex: 1 }
			]);

			const result = await controller.generateFromRecipes(userId, [recipeId1, recipeId2], 'Meal Prep');

			expect(result.name).toBe('Meal Prep');
			expect(result.items.length).toBe(4);
			const names = result.items.map(i => i.name);
			expect(names).toContain('Flour');
			expect(names).toContain('Sugar');
			expect(names).toContain('Chicken');
			expect(names).toContain('Rice');
		});

		it('should create empty list when recipes have no ingredients', async () => {
			const result = await controller.generateFromRecipes(userId, ['empty-recipe'], 'Empty');

			expect(result.name).toBe('Empty');
			expect(result.items).toEqual([]);
		});

		it('should deactivate previous lists', async () => {
			const oldList = await listRepo.create({ userId, name: 'Old', isActive: true });

			await controller.generateFromRecipes(userId, [], 'New');

			const oldStored = listRepo.getStored(oldList.id);
			expect(oldStored!.isActive).toBe(false);
		});
	});

	describe('authorization checks', () => {
		const otherUserId = 'other-user';

		it('should prevent adding item to another user list', async () => {
			const list = await listRepo.create({ userId: otherUserId, name: 'Other', isActive: true });
			await expect(controller.addItem(userId, list.id, { name: 'Milk' }))
				.rejects.toThrow('Unauthorized access to shopping list');
		});

		it('should prevent toggling item in another user list', async () => {
			const list = await listRepo.create({ userId: otherUserId, name: 'Other', isActive: true });
			const item = await itemRepo.create({ shoppingListId: list.id, name: 'Milk', orderIndex: 0 });

			await expect(controller.toggleItem(userId, item.id))
				.rejects.toThrow('Unauthorized access to shopping list');
		});

		it('should prevent removing item from another user list', async () => {
			const list = await listRepo.create({ userId: otherUserId, name: 'Other', isActive: true });
			const item = await itemRepo.create({ shoppingListId: list.id, name: 'Milk', orderIndex: 0 });

			await expect(controller.removeItem(userId, item.id))
				.rejects.toThrow('Unauthorized access to shopping list');
		});

		it('should prevent reordering items in another user list', async () => {
			const list = await listRepo.create({ userId: otherUserId, name: 'Other', isActive: true });
			const item = await itemRepo.create({ shoppingListId: list.id, name: 'Milk', orderIndex: 0 });

			await expect(controller.reorderItems(userId, list.id, [item.id]))
				.rejects.toThrow('Unauthorized access to shopping list');
		});

		it('should prevent clearing items in another user list', async () => {
			const list = await listRepo.create({ userId: otherUserId, name: 'Other', isActive: true });
			await expect(controller.clearCheckedItems(userId, list.id))
				.rejects.toThrow('Unauthorized access to shopping list');
		});
	});
});
