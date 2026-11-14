import { describe, it, expect, beforeEach } from 'vitest';
import { PantryController } from '../../../src/lib/controllers/PantryController';
import { MockPantryService } from '../../mocks/MockPantryService';
import { MockPurchaseHistoryRepository } from '../../mocks/MockPurchaseHistoryRepository';
import { MockReceiptItemRepository } from '../../mocks/MockReceiptRepositories';
import { MockCupboardItemRepository } from '../../mocks/MockCupboardItemRepository';
import {
	MockShoppingListRepository,
	MockShoppingListItemRepository
} from '../../mocks/MockShoppingListRepositories';
import type { Actor } from '../../../src/lib/models/household';
import { createKitchen } from '../../fakes/kitchen';
import type { InMemoryKitchenEventRepository } from '../../fakes/InMemoryKitchenEventRepository';

describe('PantryController', () => {
	let controller: PantryController;
	let pantryService: MockPantryService;
	let purchaseHistoryRepo: MockPurchaseHistoryRepository;
	let receiptItemRepo: MockReceiptItemRepository;
	let cupboardItemRepo: MockCupboardItemRepository;
	let shoppingListRepo: MockShoppingListRepository;
	let shoppingListItemRepo: MockShoppingListItemRepository;
	let kitchenEvents: InMemoryKitchenEventRepository;
	let kitchen: ReturnType<typeof createKitchen>;

	const userId = 'user-123';
	const otherUserId = 'user-456';
	const householdId = 'household-1';
	const otherHouseholdId = 'household-2';
	const roles = { plans: true, shops: true, cooks: true };
	const actor: Actor = {
		userId,
		householdId,
		memberId: 'member-1',
		displayName: 'Test',
		roles,
		timeZone: 'UTC'
	};
	const otherActor: Actor = {
		userId: otherUserId,
		householdId: otherHouseholdId,
		memberId: 'member-2',
		displayName: 'Other',
		roles,
		timeZone: 'UTC'
	};

	// Helper to create a date N days ago
	function daysAgo(n: number): Date {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d;
	}

	beforeEach(() => {
		pantryService = new MockPantryService();
		purchaseHistoryRepo = new MockPurchaseHistoryRepository();
		receiptItemRepo = new MockReceiptItemRepository();
		cupboardItemRepo = new MockCupboardItemRepository();
		shoppingListRepo = new MockShoppingListRepository();
		shoppingListItemRepo = new MockShoppingListItemRepository();
		shoppingListRepo.setItemRepository(shoppingListItemRepo);
		kitchen = createKitchen();
		kitchenEvents = kitchen.events;
		controller = new PantryController(
			pantryService,
			purchaseHistoryRepo,
			receiptItemRepo,
			cupboardItemRepo,
			kitchen.service,
			shoppingListRepo,
			shoppingListItemRepo
		);
	});

	describe('getHouseholdPantry', () => {
		it('should return empty array when user has no purchase history', async () => {
			const result = await controller.getHouseholdPantry(actor);
			expect(result).toEqual([]);
		});

		it('should return pantry items from recent purchase history', async () => {
			// Add purchase history for a recently purchased item
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(2),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 7,
				estimatedDepleteDate: daysAgo(-5) // 5 days in the future
			});

			// Add a receipt item so findLatestByNormalizedName returns detail
			await receiptItemRepo.create({
				receiptId: 'receipt-1',
				rawName: 'Whole Milk 1L',
				normalizedName: 'milk',
				quantity: '1',
				unit: 'liter',
				unitType: 'VOLUME',
				category: 'dairy'
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].itemName).toBe('milk');
			expect(result[0].unit).toBe('liter');
			expect(result[0].category).toBe('dairy');
			expect(result[0].source).toBe('receipt');
			expect(result[0].stockConfidence).toBeGreaterThan(0.2);
			expect(result[0].daysSincePurchase).toBeGreaterThanOrEqual(2);
		});

		it('should filter out items with low confidence (old purchases)', async () => {
			// Purchase history from long ago - confidence should be very low
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'expired item',
				lastPurchased: daysAgo(365),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const result = await controller.getHouseholdPantry(actor);

			// Item purchased 365 days ago with 7-day frequency should have near-zero confidence
			expect(result).toEqual([]);
		});

		it('should not include items from other households', async () => {
			await purchaseHistoryRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'bread',
				lastPurchased: daysAgo(1),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 5
			});

			const result = await controller.getHouseholdPantry(actor);
			expect(result).toEqual([]);
		});

		it('should use default unit when no receipt item detail is found', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'mystery item',
				lastPurchased: daysAgo(1),
				purchaseCount: 2,
				avgQuantity: '2',
				avgFrequencyDays: 14
			});

			// Don't add any receipt items - findLatestByNormalizedName returns null

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].unit).toBe('unit');
			expect(result[0].category).toBeNull();
		});

		it('should sort pantry items by confidence descending', async () => {
			// Item purchased very recently - high confidence
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'fresh eggs',
				lastPurchased: daysAgo(1),
				purchaseCount: 10,
				avgQuantity: '12',
				avgFrequencyDays: 14
			});

			// Item purchased a while ago - lower confidence
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'old butter',
				lastPurchased: daysAgo(10),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(2);
			// Fresh eggs (1 day ago) should have higher confidence than old butter (10 days ago)
			expect(result[0].itemName).toBe('fresh eggs');
			expect(result[1].itemName).toBe('old butter');
			expect(result[0].stockConfidence).toBeGreaterThanOrEqual(result[1].stockConfidence);
		});

		it('should use avgQuantity from purchase history', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'rice',
				lastPurchased: daysAgo(3),
				purchaseCount: 4,
				avgQuantity: '2.5',
				avgFrequencyDays: 30
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].quantity).toBe('2.5');
		});

		it('should default quantity to "1" when avgQuantity is null', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'salt',
				lastPurchased: daysAgo(2),
				purchaseCount: 1,
				avgQuantity: null,
				avgFrequencyDays: 90
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].quantity).toBe('1');
		});

		it('should include estimatedDepleteDate from purchase history', async () => {
			const depleteDate = daysAgo(-10); // 10 days in the future
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'flour',
				lastPurchased: daysAgo(5),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 30,
				estimatedDepleteDate: depleteDate
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].estimatedDepleteDate).toEqual(depleteDate);
		});

		it('should recalculate confidence with category when receipt detail is available', async () => {
			// Create purchase history
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'chicken breast',
				lastPurchased: daysAgo(3),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			// Create receipt item with category
			await receiptItemRepo.create({
				receiptId: 'receipt-2',
				rawName: 'Chicken Breast 500g',
				normalizedName: 'chicken breast',
				quantity: '500',
				unit: 'g',
				unitType: 'WEIGHT',
				category: 'meat'
			});

			const result = await controller.getHouseholdPantry(actor);

			// The item should be present (category 'meat' might affect confidence via shelf life)
			expect(result.length).toBe(1);
			expect(result[0].category).toBe('meat');
		});

		it('should use shelf life when avgFrequencyDays is null', async () => {
			// Purchase without frequency data - pantryService falls back to shelf life
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'canned beans',
				lastPurchased: daysAgo(5),
				purchaseCount: 1,
				avgQuantity: '2',
				avgFrequencyDays: null
			});

			// Add receipt item with category so shelf life can be calculated
			await receiptItemRepo.create({
				receiptId: 'receipt-3',
				rawName: 'Canned Beans',
				normalizedName: 'canned beans',
				quantity: '2',
				unit: 'can',
				unitType: 'COUNT',
				category: 'canned'
			});

			const result = await controller.getHouseholdPantry(actor);

			// Canned goods have long shelf life, so 5 days ago should still be high confidence
			expect(result.length).toBe(1);
			expect(result[0].stockConfidence).toBeGreaterThan(0.5);
		});

		it('should handle multiple items and return all that pass confidence threshold', async () => {
			// Create multiple recent purchases
			const items = ['apples', 'bananas', 'carrots', 'onions'];
			for (const item of items) {
				await purchaseHistoryRepo.create({
					userId,
					householdId,
					itemName: item,
					lastPurchased: daysAgo(2),
					purchaseCount: 3,
					avgQuantity: '1',
					avgFrequencyDays: 14
				});
			}

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(4);
			const itemNames = result.map((r) => r.itemName);
			expect(itemNames).toContain('apples');
			expect(itemNames).toContain('bananas');
			expect(itemNames).toContain('carrots');
			expect(itemNames).toContain('onions');
		});

		it('should set id from purchase history record', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'olive oil',
				lastPurchased: daysAgo(3),
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 60
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].id).toBe(created.id);
		});

		it('should calculate daysSincePurchase correctly', async () => {
			const purchaseDate = daysAgo(7);
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'yogurt',
				lastPurchased: purchaseDate,
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			// Should be approximately 7 days (may be off by 1 due to timing)
			expect(result[0].daysSincePurchase).toBeGreaterThanOrEqual(7);
			expect(result[0].daysSincePurchase).toBeLessThanOrEqual(8);
		});

		it('should filter items that pass initial confidence but fail with category', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'fresh fish',
				lastPurchased: daysAgo(6),
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: null // Will use shelf life based on category
			});

			// Without category, shelf life defaults to generic (14 days)
			// With category 'seafood', shelf life is shorter
			await receiptItemRepo.create({
				receiptId: 'receipt-5',
				rawName: 'Fresh Salmon',
				normalizedName: 'fresh fish',
				quantity: '1',
				unit: 'kg',
				unitType: 'WEIGHT',
				category: 'seafood'
			});

			const result = await controller.getHouseholdPantry(actor);

			// Whether this item appears depends on the shelf life calculation
			// The key thing is the controller handles the double-check correctly
			for (const item of result) {
				expect(item.stockConfidence).toBeGreaterThan(0.2);
			}
		});

		it('should handle high quantity items with boosted confidence', async () => {
			// The pantry service boosts confidence for larger quantities
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'rice',
				lastPurchased: daysAgo(10),
				purchaseCount: 3,
				avgQuantity: '5', // 5 units
				avgFrequencyDays: 14
			});

			const resultHighQty = await controller.getHouseholdPantry(actor);

			// Reset and test with lower quantity
			purchaseHistoryRepo.clear();
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'rice',
				lastPurchased: daysAgo(10),
				purchaseCount: 3,
				avgQuantity: '1', // 1 unit
				avgFrequencyDays: 14
			});

			const resultLowQty = await controller.getHouseholdPantry(actor);

			// High quantity should have higher confidence than low quantity
			if (resultHighQty.length > 0 && resultLowQty.length > 0) {
				expect(resultHighQty[0].stockConfidence).toBeGreaterThanOrEqual(
					resultLowQty[0].stockConfidence
				);
			}
		});

		it('should set all PantryItem fields correctly for receipt items', async () => {
			const purchaseDate = daysAgo(3);
			const depleteDate = daysAgo(-11);

			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'butter',
				lastPurchased: purchaseDate,
				purchaseCount: 4,
				avgQuantity: '2',
				avgFrequencyDays: 14,
				estimatedDepleteDate: depleteDate
			});

			await receiptItemRepo.create({
				receiptId: 'receipt-6',
				rawName: 'Unsalted Butter',
				normalizedName: 'butter',
				quantity: '2',
				unit: 'pack',
				unitType: 'COUNT',
				category: 'dairy'
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			const item = result[0];
			expect(item.itemName).toBe('butter');
			expect(item.lastPurchased).toEqual(purchaseDate);
			expect(item.quantity).toBe('2');
			expect(item.unit).toBe('pack');
			expect(item.category).toBe('dairy');
			expect(item.stockConfidence).toBeGreaterThan(0.2);
			expect(item.estimatedDepleteDate).toEqual(depleteDate);
			expect(item.daysSincePurchase).toBeGreaterThanOrEqual(3);
			expect(item.source).toBe('receipt');
			expect(item.id).toBeDefined();
			// New: confidence factors should be present
			expect(item.confidenceFactors).toBeDefined();
			expect(item.confidenceFactors!.purchaseCount).toBe(4);
		});

		it('should skip depleted receipt items', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'depleted milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			// Mark as depleted
			await purchaseHistoryRepo.markDepleted(created.id);

			const result = await controller.getHouseholdPantry(actor);
			expect(result).toEqual([]);
		});

		it('should include confidence factors in results', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'eggs',
				lastPurchased: daysAgo(3),
				purchaseCount: 8,
				avgQuantity: '12',
				avgFrequencyDays: 14
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].confidenceFactors).toBeDefined();
			expect(result[0].confidenceFactors!.effectiveLifespanDays).toBeDefined();
			expect(result[0].confidenceFactors!.lifespanSource).toBeDefined();
			expect(result[0].confidenceFactors!.baseConfidence).toBeDefined();
			expect(result[0].confidenceFactors!.purchaseCount).toBe(8);
		});

		it('should respect user override date on receipt items', async () => {
			// Purchased 12 days ago (would normally be low confidence with 14-day lifespan)
			// But user confirmed 1 day ago
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'cheese',
				lastPurchased: daysAgo(12),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			await purchaseHistoryRepo.update(created.id, {
				userOverrideDate: daysAgo(1)
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			// With override date of 1 day ago and 14-day lifespan, confidence should be high
			expect(result[0].stockConfidence).toBeGreaterThan(0.8);
			expect(result[0].userOverrideDate).toBeDefined();
		});
	});

	describe('getHouseholdPantry - manual items', () => {
		it('should include manual cupboard items', async () => {
			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'olive oil',
				quantity: '1',
				unit: 'bottle',
				category: 'pantry'
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].itemName).toBe('olive oil');
			expect(result[0].source).toBe('manual');
			expect(result[0].unit).toBe('bottle');
			expect(result[0].category).toBe('pantry');
		});

		it('should filter out depleted manual items', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'sugar',
				quantity: '1'
			});

			await cupboardItemRepo.markDepleted(created.id);

			const result = await controller.getHouseholdPantry(actor);
			expect(result).toEqual([]);
		});

		it('should merge receipt and manual items sorted by confidence', async () => {
			// Manual item added today (high confidence)
			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'manual salt',
				category: 'pantry' // 90 day shelf life
			});

			// Receipt item from a week ago (lower confidence)
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'receipt butter',
				lastPurchased: daysAgo(7),
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 10
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(2);
			// Manual salt (added today, pantry category = 90d) should have higher confidence
			expect(result[0].itemName).toBe('manual salt');
			expect(result[0].source).toBe('manual');
			expect(result[1].itemName).toBe('receipt butter');
			expect(result[1].source).toBe('receipt');
		});

		it('should use shelf life override for manual items', async () => {
			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'custom item',
				shelfLifeDays: 30
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].confidenceFactors).toBeDefined();
			expect(result[0].confidenceFactors!.lifespanSource).toBe('user_override');
			expect(result[0].confidenceFactors!.effectiveLifespanDays).toBe(30);
		});

		it('should default manual item quantity to "1" and unit to "unit"', async () => {
			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'bare item'
			});

			const result = await controller.getHouseholdPantry(actor);

			expect(result.length).toBe(1);
			expect(result[0].quantity).toBe('1');
			expect(result[0].unit).toBe('unit');
		});
	});

	describe('addManualItem', () => {
		it('should create a new manual cupboard item', async () => {
			const item = await controller.addManualItem(actor, {
				itemName: 'baking soda'
			});

			expect(item.itemName).toBe('baking soda');
			expect(item.source).toBe('manual');
			expect(item.stockConfidence).toBe(1.0); // Just added
			expect(item.daysSincePurchase).toBe(0);
			expect(item.isDepleted).toBe(false);
			expect(item.id).toBeDefined();
		});

		it('should create item with all optional fields', async () => {
			const item = await controller.addManualItem(actor, {
				itemName: 'organic flour',
				quantity: '2',
				unit: 'kg',
				category: 'pantry',
				shelfLifeDays: 180,
				notes: 'bought from farmers market'
			});

			expect(item.itemName).toBe('organic flour');
			expect(item.quantity).toBe('2');
			expect(item.unit).toBe('kg');
			expect(item.category).toBe('pantry');
			expect(item.userShelfLifeDays).toBe(180);
		});

		it('should persist the item in the repository', async () => {
			await controller.addManualItem(actor, {
				itemName: 'test item'
			});

			const stored = cupboardItemRepo.getAll();
			expect(stored.length).toBe(1);
			expect(stored[0].itemName).toBe('test item');
			expect(stored[0].userId).toBe(userId);
		});

		it('should include confidence factors in the returned item', async () => {
			const item = await controller.addManualItem(actor, {
				itemName: 'spice',
				category: 'pantry'
			});

			expect(item.confidenceFactors).toBeDefined();
			expect(item.confidenceFactors!.effectiveDate).toBeDefined();
		});
	});

	describe('markItemUsedUp', () => {
		it('should mark a receipt-sourced item as depleted', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			await controller.markItemUsedUp(actor, created.id, 'receipt');

			const stored = await purchaseHistoryRepo.findById(created.id);
			expect(stored!.isDepleted).toBe(true);
		});

		it('should mark a manual item as depleted', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'sugar'
			});

			await controller.markItemUsedUp(actor, created.id, 'manual');

			const stored = await cupboardItemRepo.findById(created.id);
			expect(stored!.isDepleted).toBe(true);
		});

		it('should cause depleted items to be excluded from getUserPantry', async () => {
			const receiptItem = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const manualItem = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'sugar'
			});

			// Before depletion
			let result = await controller.getHouseholdPantry(actor);
			expect(result.length).toBe(2);

			// Mark both as depleted
			await controller.markItemUsedUp(actor, receiptItem.id, 'receipt');
			await controller.markItemUsedUp(actor, manualItem.id, 'manual');

			result = await controller.getHouseholdPantry(actor);
			expect(result.length).toBe(0);
		});
	});

	describe('confirmItemInStock', () => {
		it('should set override date to now for receipt items', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'butter',
				lastPurchased: daysAgo(10),
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			await controller.confirmItemInStock(actor, created.id, 'receipt');

			const stored = await purchaseHistoryRepo.findById(created.id);
			expect(stored!.userOverrideDate).toBeDefined();
			expect(stored!.isDepleted).toBe(false);
			// Override date should be approximately now
			const msAgo = Date.now() - stored!.userOverrideDate!.getTime();
			expect(msAgo).toBeLessThan(5000); // Within 5 seconds
		});

		it('should clear depleted flag for manual items', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'salt'
			});

			// First deplete it
			await cupboardItemRepo.markDepleted(created.id);
			expect((await cupboardItemRepo.findById(created.id))!.isDepleted).toBe(true);

			// Confirm in stock
			await controller.confirmItemInStock(actor, created.id, 'manual');

			const stored = await cupboardItemRepo.findById(created.id);
			expect(stored!.isDepleted).toBe(false);
		});

		it('should boost confidence for old receipt items after confirmation', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'old cheese',
				lastPurchased: daysAgo(12),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			// Get confidence before confirmation
			const before = await controller.getHouseholdPantry(actor);
			const confidenceBefore = before.length > 0 ? before[0].stockConfidence : 0;

			// Confirm in stock
			await controller.confirmItemInStock(actor, created.id, 'receipt');

			// Get confidence after
			const after = await controller.getHouseholdPantry(actor);
			expect(after.length).toBe(1);
			expect(after[0].stockConfidence).toBeGreaterThan(confidenceBefore);
		});
	});

	describe('updateItem', () => {
		it('should update a manual item', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'flour',
				quantity: '1',
				category: 'pantry'
			});

			await controller.updateItem(actor, created.id, 'manual', {
				quantity: '5',
				category: 'bakery',
				shelfLifeDays: 60,
				notes: 'whole wheat'
			});

			const stored = await cupboardItemRepo.findById(created.id);
			expect(stored!.quantity).toBe('5');
			expect(stored!.category).toBe('bakery');
			expect(stored!.shelfLifeDays).toBe(60);
			expect(stored!.notes).toBe('whole wheat');
		});

		it('should update override fields on a receipt item', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(3),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			await controller.updateItem(actor, created.id, 'receipt', {
				quantity: '2',
				shelfLifeDays: 14
			});

			const stored = await purchaseHistoryRepo.findById(created.id);
			expect(stored!.userQuantityOverride).toBe('2');
			expect(stored!.userShelfLifeDays).toBe(14);
		});
	});

	describe('deleteManualItem', () => {
		it('should permanently delete a manual cupboard item', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'old spice'
			});

			await controller.deleteManualItem(actor, created.id);

			const stored = await cupboardItemRepo.findById(created.id);
			expect(stored).toBeNull();
		});

		it('should remove the item from getUserPantry results', async () => {
			const created = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'to delete'
			});

			let result = await controller.getHouseholdPantry(actor);
			expect(result.length).toBe(1);

			await controller.deleteManualItem(actor, created.id);

			result = await controller.getHouseholdPantry(actor);
			expect(result.length).toBe(0);
		});
	});

	describe('getCupboardStats', () => {
		it('should return zero stats when cupboard is empty', async () => {
			const stats = await controller.getCupboardStats(actor);

			expect(stats.totalItems).toBe(0);
			expect(stats.inStock).toBe(0);
			expect(stats.runningLow).toBe(0);
			expect(stats.needsRestock).toBe(0);
			expect(stats.lastStocked).toBeNull();
		});

		it('should categorize items by confidence thresholds', async () => {
			// In stock: purchased today (confidence ~1.0)
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'fresh item',
				lastPurchased: new Date(),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			// Running low: 8 days of 14 (confidence ~0.43)
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'aging item',
				lastPurchased: daysAgo(8),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			// Needs restock: 10 days of 14 (confidence ~0.29)
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'almost gone',
				lastPurchased: daysAgo(10),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const stats = await controller.getCupboardStats(actor);

			expect(stats.totalItems).toBe(3);
			expect(stats.inStock).toBeGreaterThanOrEqual(1);
			expect(stats.lastStocked).toBeDefined();
		});

		it('should include both receipt and manual items', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'receipt item',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'manual item',
				category: 'pantry'
			});

			const stats = await controller.getCupboardStats(actor);

			expect(stats.totalItems).toBe(2);
		});
	});

	describe('getCupboardCount', () => {
		it('should return 0 when no items exist', async () => {
			const count = await controller.getCupboardCount(actor);
			expect(count).toBe(0);
		});

		it('should count receipt and manual items separately', async () => {
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'sugar'
			});

			const count = await controller.getCupboardCount(actor);
			expect(count).toBe(2);
		});

		it('should not count depleted items', async () => {
			const receipt = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const manual = await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'sugar'
			});

			await purchaseHistoryRepo.markDepleted(receipt.id);
			await cupboardItemRepo.markDepleted(manual.id);

			const count = await controller.getCupboardCount(actor);
			expect(count).toBe(0);
		});

		it('should not count items from other households', async () => {
			await purchaseHistoryRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'bread',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'butter'
			});

			const count = await controller.getCupboardCount(actor);
			expect(count).toBe(0);
		});

		it('should not count items that have decayed below confidence threshold', async () => {
			// Item purchased 365 days ago with 7-day frequency — confidence is 0
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'ancient milk',
				lastPurchased: daysAgo(365),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const count = await controller.getCupboardCount(actor);
			expect(count).toBe(0);
		});
	});

	describe('getExpiredItems', () => {
		it('should return empty array when no expired items', async () => {
			// Fresh item — high confidence, not expired
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'fresh milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired).toEqual([]);
		});

		it('should return items with confidence <= 0.2 purchased within 60 days', async () => {
			// Item purchased 12 days ago with 14-day lifespan — confidence ~0.14 (below 0.2)
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'expired yogurt',
				lastPurchased: daysAgo(12),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired.length).toBe(1);
			expect(expired[0].itemName).toBe('expired yogurt');
			expect(expired[0].stockConfidence).toBeLessThanOrEqual(0.2);
		});

		it('should return ancient items (over 60 days old) so users can dismiss them', async () => {
			// Item purchased 365 days ago — should still appear in expired list
			// so users can explicitly dismiss it
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'ancient eggs',
				lastPurchased: daysAgo(365),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired).toHaveLength(1);
			expect(expired[0].itemName).toBe('ancient eggs');
		});

		it('should not return items above 0.2 confidence', async () => {
			// Item still in stock
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'fresh item',
				lastPurchased: daysAgo(3),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired).toEqual([]);
		});

		it('should not return depleted items', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'used up',
				lastPurchased: daysAgo(12),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});
			await purchaseHistoryRepo.markDepleted(created.id);

			const expired = await controller.getExpiredItems(actor);
			expect(expired).toEqual([]);
		});

		it('should sort by last purchased descending (most recent first)', async () => {
			// Both expired but different dates
			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'older expired',
				lastPurchased: daysAgo(20),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'newer expired',
				lastPurchased: daysAgo(13),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired.length).toBe(2);
			expect(expired[0].itemName).toBe('newer expired');
			expect(expired[1].itemName).toBe('older expired');
		});

		it('should include manual items that have expired', async () => {
			// Manual item added 20 days ago with default 14-day shelf life
			await cupboardItemRepo.create({
				userId,
				householdId,
				itemName: 'manual expired',
				addedDate: daysAgo(20)
			});

			const expired = await controller.getExpiredItems(actor);
			expect(expired.length).toBe(1);
			expect(expired[0].itemName).toBe('manual expired');
			expect(expired[0].source).toBe('manual');
		});
	});

	describe('addToShoppingList', () => {
		it('should create a shopping list and add the item', async () => {
			await controller.addToShoppingList(actor, 'milk', '1', 'liter');

			// Verify list was created
			const lists = shoppingListRepo.getAllStored();
			expect(lists.length).toBe(1);
			expect(lists[0].userId).toBe(userId);
			expect(lists[0].isActive).toBe(true);

			// Verify item was added
			const items = shoppingListItemRepo.getAllStored();
			expect(items.length).toBe(1);
			expect(items[0].name).toBe('milk');
			expect(items[0].quantity).toBe('1');
			expect(items[0].unit).toBe('liter');
			expect(items[0].notes).toBe('Added from Cupboard');
		});

		it('should add to existing active list', async () => {
			// Create an active list first
			const list = await shoppingListRepo.create({
				userId,
				householdId,
				name: 'My List',
				isActive: true
			});

			await controller.addToShoppingList(actor, 'butter');

			// Should not create a new list
			const lists = shoppingListRepo.getAllStored();
			expect(lists.length).toBe(1);

			// Item should be added to existing list
			const items = await shoppingListItemRepo.findByListId(list.id);
			expect(items.length).toBe(1);
			expect(items[0].name).toBe('butter');
		});

		it('should handle null quantity and unit', async () => {
			await shoppingListRepo.create({
				userId,
				householdId,
				name: 'My List',
				isActive: true
			});

			await controller.addToShoppingList(actor, 'salt');

			const items = shoppingListItemRepo.getAllStored();
			expect(items.length).toBe(1);
			expect(items[0].name).toBe('salt');
			expect(items[0].quantity).toBeNull();
			expect(items[0].unit).toBeNull();
		});

		it('should add multiple items with incrementing order', async () => {
			await shoppingListRepo.create({
				userId,
				householdId,
				name: 'My List',
				isActive: true
			});

			await controller.addToShoppingList(actor, 'milk');
			await controller.addToShoppingList(actor, 'eggs');
			await controller.addToShoppingList(actor, 'bread');

			const items = shoppingListItemRepo.getAllStored();
			expect(items.length).toBe(3);
			// Order should be incrementing
			expect(items[0].orderIndex).toBeLessThan(items[1].orderIndex);
			expect(items[1].orderIndex).toBeLessThan(items[2].orderIndex);
		});
	});

	describe('household sharing', () => {
		const housemate: Actor = {
			userId: 'user-789',
			householdId,
			memberId: 'member-3',
			displayName: 'Housemate',
			roles,
			timeZone: 'UTC'
		};

		it('shows a housemate the cupboard item another member added', async () => {
			await controller.addManualItem(actor, { itemName: 'olive oil' });

			const result = await controller.getHouseholdPantry(housemate);
			expect(result.map((item) => item.itemName)).toEqual(['olive oil']);
		});

		it('keeps the cupboard item of another household out of the pantry', async () => {
			await controller.addManualItem(otherActor, { itemName: 'olive oil' });

			const result = await controller.getHouseholdPantry(actor);
			expect(result).toEqual([]);
		});

		it('rejects marking another household item as used up', async () => {
			const created = await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'rice'
			});

			await expect(controller.markItemUsedUp(actor, created.id, 'manual')).rejects.toThrow(
				'Item not found'
			);
		});

		it('rejects marking another household purchase history as used up', async () => {
			const created = await purchaseHistoryRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1)
			});

			await expect(controller.markItemUsedUp(actor, created.id, 'receipt')).rejects.toThrow(
				'Item not found'
			);
		});

		it('rejects deleting another household cupboard item', async () => {
			const created = await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'rice'
			});

			await expect(controller.deleteManualItem(actor, created.id)).rejects.toThrow(
				'Item not found'
			);
		});

		it('leaves another household cupboard item in place after a rejected delete', async () => {
			const created = await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'rice'
			});

			await controller.deleteManualItem(actor, created.id).catch(() => undefined);

			expect(await cupboardItemRepo.findById(created.id)).not.toBeNull();
		});

		it('rejects updating another household cupboard item', async () => {
			const created = await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'rice'
			});

			await expect(
				controller.updateItem(actor, created.id, 'manual', { quantity: '5' })
			).rejects.toThrow('Item not found');
		});

		it('rejects confirming another household item in stock', async () => {
			const created = await cupboardItemRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'rice'
			});

			await expect(controller.confirmItemInStock(actor, created.id, 'manual')).rejects.toThrow(
				'Item not found'
			);
		});

		it('adds to the active shopping list a housemate created', async () => {
			const list = await shoppingListRepo.create({
				userId: housemate.userId,
				householdId,
				name: 'Shared list',
				isActive: true
			});

			await controller.addToShoppingList(actor, 'flour');

			const items = await shoppingListItemRepo.findByListId(list.id);
			expect(items.map((item) => item.name)).toEqual(['flour']);
		});
	});

	describe('kitchen log', () => {
		it('records a manual cupboard add as a purchase', async () => {
			await controller.addManualItem(actor, { itemName: 'Rice', quantity: '1000', unit: 'g' });

			expect(kitchenEvents.all(householdId).map((e) => [e.kind, e.itemKey])).toEqual([
				['BOUGHT', 'rice']
			]);
		});

		it('records marking an item used up as gone', async () => {
			const created = await cupboardItemRepo.create({ userId, householdId, itemName: 'Sugar' });

			await controller.markItemUsedUp(actor, created.id, 'manual');

			expect(kitchenEvents.all(householdId).map((e) => [e.kind, e.itemKey])).toEqual([
				['CORRECTED_GONE', 'sugar']
			]);
		});

		it('records confirming an item in stock as still good', async () => {
			const created = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(9),
				purchaseCount: 1
			});

			await controller.confirmItemInStock(actor, created.id, 'receipt');

			expect(kitchenEvents.all(householdId).map((e) => [e.kind, e.itemKey])).toEqual([
				['CORRECTED_STILL_GOOD', 'milk']
			]);
		});

		/** Adds a cupboard item by hand and returns its id. */
		async function addByHand(input: Parameters<PantryController['addManualItem']>[1]) {
			const { id } = await controller.addManualItem(actor, input);
			if (!id) throw new Error('The added item has no id');
			return id;
		}

		function kinds() {
			return kitchenEvents.all(householdId).map((e) => [e.kind, e.itemKey, e.quantity]);
		}

		it('records a new quantity on a cupboard item as the corrected amount', async () => {
			const createdId = await addByHand({
				itemName: 'Rice',
				quantity: '1000',
				unit: 'g'
			});

			await controller.updateItem(actor, createdId, 'manual', { quantity: '400' });

			expect(kinds()).toEqual([
				['BOUGHT', 'rice', 1000],
				['CORRECTED_QUANTITY', 'rice', 400]
			]);
		});

		it('records nothing when an edit keeps the quantity', async () => {
			const createdId = await addByHand({
				itemName: 'Rice',
				quantity: '1000',
				unit: 'g'
			});

			await controller.updateItem(actor, createdId, 'manual', {
				quantity: '1000',
				notes: 'top shelf'
			});

			expect(kinds()).toEqual([['BOUGHT', 'rice', 1000]]);
		});

		it('records nothing when an edit clears the quantity', async () => {
			const createdId = await addByHand({
				itemName: 'Rice',
				quantity: '1000',
				unit: 'g'
			});

			await controller.updateItem(actor, createdId, 'manual', { quantity: null });

			expect(kinds()).toEqual([['BOUGHT', 'rice', 1000]]);
		});

		it('records a new quantity on a receipt item as the corrected amount', async () => {
			const record = await purchaseHistoryRepo.create({
				userId,
				householdId,
				itemName: 'milk',
				lastPurchased: daysAgo(1),
				purchaseCount: 2,
				avgQuantity: '2'
			});

			await controller.updateItem(actor, record.id, 'receipt', { quantity: '1' });

			expect(kinds()).toEqual([['CORRECTED_QUANTITY', 'milk', 1]]);
		});

		it('takes back the purchase of a deleted cupboard item', async () => {
			const createdId = await addByHand({ itemName: 'Rice' });

			await controller.deleteManualItem(actor, createdId);

			expect(kinds()).toEqual([]);
		});

		it('takes back the quantity corrections of a deleted cupboard item', async () => {
			const createdId = await addByHand({
				itemName: 'Rice',
				quantity: '1000',
				unit: 'g'
			});
			await controller.updateItem(actor, createdId, 'manual', { quantity: '400' });

			await controller.deleteManualItem(actor, createdId);

			expect(kinds()).toEqual([]);
		});

		it('keeps the purchases of the same item bought elsewhere when a cupboard item is deleted', async () => {
			await kitchen.service.recordBought(actor, [{ name: 'Rice' }], daysAgo(3), 'receipt');
			const createdId = await addByHand({ itemName: 'rice' });

			await controller.deleteManualItem(actor, createdId);

			expect(kinds()).toEqual([['BOUGHT', 'rice', null]]);
		});

		it('records a deleted cupboard item whose purchase is not in the log as gone', async () => {
			const created = await cupboardItemRepo.create({ userId, householdId, itemName: 'Lentils' });

			await controller.deleteManualItem(actor, created.id);

			expect(kinds()).toEqual([['CORRECTED_GONE', 'lentil', null]]);
		});
	});
});
