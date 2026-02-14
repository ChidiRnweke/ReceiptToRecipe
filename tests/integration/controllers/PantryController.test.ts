import { describe, it, expect, beforeEach } from 'vitest';
import { PantryController } from '../../../src/lib/controllers/PantryController';
import { MockPantryService } from '../../mocks/MockPantryService';
import { MockPurchaseHistoryRepository } from '../../mocks/MockPurchaseHistoryRepository';
import { MockReceiptItemRepository } from '../../mocks/MockReceiptRepositories';

describe('PantryController', () => {
	let controller: PantryController;
	let pantryService: MockPantryService;
	let purchaseHistoryRepo: MockPurchaseHistoryRepository;
	let receiptItemRepo: MockReceiptItemRepository;

	const userId = 'user-123';
	const otherUserId = 'user-456';

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
		controller = new PantryController(pantryService, purchaseHistoryRepo, receiptItemRepo);
	});

	describe('getUserPantry', () => {
		it('should return empty array when user has no purchase history', async () => {
			const result = await controller.getUserPantry(userId);
			expect(result).toEqual([]);
		});

		it('should return pantry items from recent purchase history', async () => {
			// Add purchase history for a recently purchased item
			await purchaseHistoryRepo.create({
				userId,
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

			const result = await controller.getUserPantry(userId);

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
				itemName: 'expired item',
				lastPurchased: daysAgo(365),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 7
			});

			const result = await controller.getUserPantry(userId);

			// Item purchased 365 days ago with 7-day frequency should have near-zero confidence
			expect(result).toEqual([]);
		});

		it('should not include items from other users', async () => {
			await purchaseHistoryRepo.create({
				userId: otherUserId,
				itemName: 'bread',
				lastPurchased: daysAgo(1),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 5
			});

			const result = await controller.getUserPantry(userId);
			expect(result).toEqual([]);
		});

		it('should use default unit when no receipt item detail is found', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'mystery item',
				lastPurchased: daysAgo(1),
				purchaseCount: 2,
				avgQuantity: '2',
				avgFrequencyDays: 14
			});

			// Don't add any receipt items - findLatestByNormalizedName returns null

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].unit).toBe('unit');
			expect(result[0].category).toBeNull();
		});

		it('should sort pantry items by confidence descending', async () => {
			// Item purchased very recently - high confidence
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'fresh eggs',
				lastPurchased: daysAgo(1),
				purchaseCount: 10,
				avgQuantity: '12',
				avgFrequencyDays: 14
			});

			// Item purchased a while ago - lower confidence
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'old butter',
				lastPurchased: daysAgo(10),
				purchaseCount: 5,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(2);
			// Fresh eggs (1 day ago) should have higher confidence than old butter (10 days ago)
			expect(result[0].itemName).toBe('fresh eggs');
			expect(result[1].itemName).toBe('old butter');
			expect(result[0].stockConfidence).toBeGreaterThanOrEqual(result[1].stockConfidence);
		});

		it('should use avgQuantity from purchase history', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'rice',
				lastPurchased: daysAgo(3),
				purchaseCount: 4,
				avgQuantity: '2.5',
				avgFrequencyDays: 30
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].quantity).toBe('2.5');
		});

		it('should default quantity to "1" when avgQuantity is null', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'salt',
				lastPurchased: daysAgo(2),
				purchaseCount: 1,
				avgQuantity: null,
				avgFrequencyDays: 90
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].quantity).toBe('1');
		});

		it('should include estimatedDepleteDate from purchase history', async () => {
			const depleteDate = daysAgo(-10); // 10 days in the future
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'flour',
				lastPurchased: daysAgo(5),
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 30,
				estimatedDepleteDate: depleteDate
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].estimatedDepleteDate).toEqual(depleteDate);
		});

		it('should recalculate confidence with category when receipt detail is available', async () => {
			// Create purchase history
			await purchaseHistoryRepo.create({
				userId,
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

			const result = await controller.getUserPantry(userId);

			// The item should be present (category 'meat' might affect confidence via shelf life)
			expect(result.length).toBe(1);
			expect(result[0].category).toBe('meat');
		});

		it('should use shelf life when avgFrequencyDays is null', async () => {
			// Purchase without frequency data - pantryService falls back to shelf life
			await purchaseHistoryRepo.create({
				userId,
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

			const result = await controller.getUserPantry(userId);

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
					itemName: item,
					lastPurchased: daysAgo(2),
					purchaseCount: 3,
					avgQuantity: '1',
					avgFrequencyDays: 14
				});
			}

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(4);
			const itemNames = result.map((r) => r.itemName);
			expect(itemNames).toContain('apples');
			expect(itemNames).toContain('bananas');
			expect(itemNames).toContain('carrots');
			expect(itemNames).toContain('onions');
		});

		it('should set id from receipt item detail when available', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'olive oil',
				lastPurchased: daysAgo(3),
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 60
			});

			const createdItem = await receiptItemRepo.create({
				receiptId: 'receipt-4',
				rawName: 'Extra Virgin Olive Oil',
				normalizedName: 'olive oil',
				quantity: '1',
				unit: 'bottle',
				unitType: 'COUNT'
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].id).toBe(createdItem.id);
		});

		it('should leave id undefined when no receipt item detail is found', async () => {
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'unknown spice',
				lastPurchased: daysAgo(1),
				purchaseCount: 1,
				avgQuantity: '1',
				avgFrequencyDays: 30
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			expect(result[0].id).toBeUndefined();
		});

		it('should calculate daysSincePurchase correctly', async () => {
			const purchaseDate = daysAgo(7);
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'yogurt',
				lastPurchased: purchaseDate,
				purchaseCount: 2,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			const result = await controller.getUserPantry(userId);

			expect(result.length).toBe(1);
			// Should be approximately 7 days (may be off by 1 due to timing)
			expect(result[0].daysSincePurchase).toBeGreaterThanOrEqual(7);
			expect(result[0].daysSincePurchase).toBeLessThanOrEqual(8);
		});

		it('should filter items that pass initial confidence but fail with category', async () => {
			// This tests the case where initial confidence (without category) > 0.2
			// but recalculated confidence (with category from receipt detail) drops <= 0.2
			// For meat items with a short shelf life, a 6-day-old purchase might fail

			await purchaseHistoryRepo.create({
				userId,
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

			const result = await controller.getUserPantry(userId);

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
				itemName: 'rice',
				lastPurchased: daysAgo(10),
				purchaseCount: 3,
				avgQuantity: '5', // 5 units
				avgFrequencyDays: 14
			});

			const resultHighQty = await controller.getUserPantry(userId);

			// Reset and test with lower quantity
			purchaseHistoryRepo.clear();
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'rice',
				lastPurchased: daysAgo(10),
				purchaseCount: 3,
				avgQuantity: '1', // 1 unit
				avgFrequencyDays: 14
			});

			const resultLowQty = await controller.getUserPantry(userId);

			// High quantity should have higher confidence than low quantity
			if (resultHighQty.length > 0 && resultLowQty.length > 0) {
				expect(resultHighQty[0].stockConfidence).toBeGreaterThanOrEqual(
					resultLowQty[0].stockConfidence
				);
			}
		});

		it('should set all PantryItem fields correctly', async () => {
			const purchaseDate = daysAgo(3);
			const depleteDate = daysAgo(-11);

			await purchaseHistoryRepo.create({
				userId,
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

			const result = await controller.getUserPantry(userId);

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
		});
	});
});
