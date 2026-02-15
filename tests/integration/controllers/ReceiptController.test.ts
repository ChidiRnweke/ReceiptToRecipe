import { describe, it, expect, beforeEach } from 'vitest';
import { ReceiptController } from '../../../src/lib/controllers/ReceiptController';
import { NormalizationService } from '../../../src/lib/services/NormalizationService';
import { MockStorageService } from '../../mocks/MockStorageService';
import { MockReceiptExtractor } from '../../mocks/MockReceiptExtractor';
import { MockProductNormalizer } from '../../mocks/MockProductNormalizer';
import { MockPantryService } from '../../mocks/MockPantryService';
import {
	MockReceiptRepository,
	MockReceiptItemRepository
} from '../../mocks/MockReceiptRepositories';
import { MockPurchaseHistoryRepository } from '../../mocks/MockPurchaseHistoryRepository';
import { MockJobQueue } from '../../mocks/MockJobQueue';

describe('ReceiptController', () => {
	let controller: ReceiptController;
	let storageService: MockStorageService;
	let receiptExtractor: MockReceiptExtractor;
	let normalizationService: NormalizationService;
	let productNormalizer: MockProductNormalizer;
	let pantryService: MockPantryService;
	let receiptRepo: MockReceiptRepository;
	let receiptItemRepo: MockReceiptItemRepository;
	let purchaseHistoryRepo: MockPurchaseHistoryRepository;
	let jobQueue: MockJobQueue;

	const userId = 'user-123';
	const otherUserId = 'user-456';

	/**
	 * Helper: create a fake File object for upload tests
	 */
	function createFakeFile(name: string, content: string = 'fake-image-data'): File {
		const blob = new Blob([content], { type: 'image/jpeg' });
		return new File([blob], name, { type: 'image/jpeg' });
	}

	/**
	 * Helper: flush microtasks so fire-and-forget job queue runs complete.
	 * The ReceiptController calls `this.jobQueue.add(...).catch(...)` without awaiting it,
	 * so we need to let the microtask queue drain before asserting on side effects.
	 */
	async function flushMicrotasks(): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	beforeEach(() => {
		storageService = new MockStorageService();
		receiptExtractor = new MockReceiptExtractor();
		normalizationService = new NormalizationService();
		productNormalizer = new MockProductNormalizer();
		pantryService = new MockPantryService();
		receiptRepo = new MockReceiptRepository();
		receiptItemRepo = new MockReceiptItemRepository();
		purchaseHistoryRepo = new MockPurchaseHistoryRepository();
		jobQueue = new MockJobQueue();

		// Wire the item repo into the receipt repo for findByIdWithItems / findByUserIdWithItems
		receiptRepo.setItemRepository(receiptItemRepo);

		controller = new ReceiptController(
			storageService,
			receiptExtractor,
			normalizationService,
			productNormalizer,
			pantryService,
			receiptRepo,
			receiptItemRepo,
			purchaseHistoryRepo,
			jobQueue
		);
	});

	// ---------- uploadReceipt ----------

	describe('uploadReceipt', () => {
		it('should store the image in storage service', async () => {
			receiptExtractor.setDefaultData({ items: [] });

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			expect(storageService.getStored('receipts/receipt.jpg')).toBeDefined();
			expect(receipt.imageUrl).toBe('mock://receipts/receipt.jpg');
		});

		it('should create a receipt record with QUEUED status', async () => {
			receiptExtractor.setDefaultData({ items: [] });

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });

			// At the point of return, the receipt was created as QUEUED
			expect(receipt.userId).toBe(userId);
			expect(receipt.status).toBe('QUEUED');
			expect(receipt.imageUrl).toContain('receipt.jpg');
		});

		it('should enqueue an OCR job via the job queue', async () => {
			receiptExtractor.setDefaultData({ items: [] });

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const jobNames = jobQueue.getExecutedJobNames();
			expect(jobNames).toContain(`receipt:${receipt.id}`);
		});

		it('should process OCR and transition status QUEUED → PROCESSING → DONE', async () => {
			receiptExtractor.setDefaultData({
				storeName: 'Test Store',
				purchaseDate: '2025-01-15',
				total: '$42.50',
				currency: 'USD',
				items: [{ name: 'Whole Milk', quantity: '1', price: '$3.99' }]
			});

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			// After processing, the receipt should be DONE
			const stored = receiptRepo.getStored(receipt.id);
			expect(stored).toBeDefined();
			expect(stored!.status).toBe('DONE');
			expect(stored!.storeName).toBe('Test Store');
			expect(stored!.currency).toBe('USD');
			expect(stored!.totalAmount).toBe('42.50');
		});

		it('should normalize OCR items and create receipt items', async () => {
			productNormalizer.setMock('Whole Milk 1L', {
				normalizedName: 'whole milk',
				productGroup: 'Dairy',
				category: 'dairy',
				isFoodItem: true
			});

			receiptExtractor.setDefaultData({
				items: [{ name: 'Whole Milk 1L', quantity: '2', price: '$5.99' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(1);
			expect(items[0].rawName).toBe('Whole Milk 1L');
			expect(items[0].normalizedName).toBe('whole milk');
			expect(items[0].quantity).toBe('2');
			expect(items[0].category).toBe('dairy');
			expect(items[0].productGroup).toBe('Dairy');
			expect(items[0].price).toBe('5.99');
		});

		it('should handle items with no quantity by defaulting to 1', async () => {
			receiptExtractor.setDefaultData({
				items: [{ name: 'Bananas', price: '$1.29' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(1);
			expect(items[0].quantity).toBe('1');
		});

		it('should handle items with empty/falsy name as "Unknown Item"', async () => {
			receiptExtractor.setDefaultData({
				items: [{ name: '', quantity: '1' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(1);
			expect(items[0].rawName).toBe('Unknown Item');
		});

		it('should create purchase history for new items', async () => {
			receiptExtractor.setDefaultData({
				purchaseDate: '2025-06-01',
				items: [{ name: 'Milk', quantity: '2' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const history = purchaseHistoryRepo.getAll();
			expect(history).toHaveLength(1);
			expect(history[0].userId).toBe(userId);
			expect(history[0].itemName).toBe('Milk');
			expect(history[0].purchaseCount).toBe(1);
			expect(history[0].avgQuantity).toBe('2');
			expect(history[0].avgFrequencyDays).toBeNull();
		});

		it('should update existing purchase history with averaged frequency', async () => {
			// Seed existing purchase history: last purchase was 10 days ago
			const tenDaysAgo = new Date('2025-05-20');
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Milk',
				lastPurchased: tenDaysAgo,
				purchaseCount: 3,
				avgQuantity: '1',
				avgFrequencyDays: 14
			});

			receiptExtractor.setDefaultData({
				purchaseDate: '2025-05-30',
				items: [{ name: 'Milk', quantity: '2' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const history = purchaseHistoryRepo.getAll();
			expect(history).toHaveLength(1);
			expect(history[0].purchaseCount).toBe(4);
			// Average frequency: (14 + 10) / 2 = 12
			expect(history[0].avgFrequencyDays).toBe(12);
			// Average quantity: (1 + 2) / 2 = 1.5
			expect(history[0].avgQuantity).toBe('1.5');
			// lastPurchased should be updated to the newer date
			expect(history[0].lastPurchased.getTime()).toBe(new Date('2025-05-30').getTime());
		});

		it('should not update lastPurchased when processing an older receipt', async () => {
			// Existing history with a more recent purchase
			const recentDate = new Date('2025-06-15');
			await purchaseHistoryRepo.create({
				userId,
				itemName: 'Eggs',
				lastPurchased: recentDate,
				purchaseCount: 2,
				avgQuantity: '12',
				avgFrequencyDays: 7,
				estimatedDepleteDate: new Date('2025-06-22')
			});

			// Processing an older receipt
			receiptExtractor.setDefaultData({
				purchaseDate: '2025-06-01',
				items: [{ name: 'Eggs', quantity: '12' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const history = purchaseHistoryRepo.getAll();
			expect(history).toHaveLength(1);
			// lastPurchased should remain the more recent date
			expect(history[0].lastPurchased.getTime()).toBe(recentDate.getTime());
			// estimatedDepleteDate should also remain unchanged
			expect(history[0].estimatedDepleteDate!.getTime()).toBe(new Date('2025-06-22').getTime());
		});

		it('should handle OCR failure and set status to FAILED', async () => {
			// Make the extractor throw
			receiptExtractor.setMock('mock://receipts/receipt.jpg', null as any);
			// Override extractReceiptFromBuffer to throw (controller now passes buffer directly)
			receiptExtractor.extractReceiptFromBuffer = async () => {
				throw new Error('OCR service unavailable');
			};

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const stored = receiptRepo.getStored(receipt.id);
			expect(stored!.status).toBe('FAILED');
			expect(stored!.errorMessage).toBe('OCR service unavailable');
		});

		it('should handle invalid purchase date gracefully', async () => {
			receiptExtractor.setDefaultData({
				purchaseDate: 'not-a-date',
				items: [{ name: 'Bread', quantity: '1' }]
			});

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const stored = receiptRepo.getStored(receipt.id);
			expect(stored!.status).toBe('DONE');
			// Should fall back to current date (a Date object, not NaN)
			expect(stored!.purchaseDate).toBeInstanceOf(Date);
			expect(isNaN(stored!.purchaseDate!.getTime())).toBe(false);
		});

		it('should handle receipt with no items', async () => {
			receiptExtractor.setDefaultData({
				storeName: 'Empty Store',
				items: []
			});

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const stored = receiptRepo.getStored(receipt.id);
			expect(stored!.status).toBe('DONE');
			expect(receiptItemRepo.getAllStored()).toHaveLength(0);
			expect(purchaseHistoryRepo.getAll()).toHaveLength(0);
		});

		it('should process multiple items and create purchase history for each', async () => {
			receiptExtractor.setDefaultData({
				purchaseDate: '2025-03-15',
				items: [
					{ name: 'Milk', quantity: '1', price: '$3.99' },
					{ name: 'Bread', quantity: '2', price: '$2.49' },
					{ name: 'Eggs', quantity: '12', price: '$4.99' }
				]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			expect(receiptItemRepo.getAllStored()).toHaveLength(3);
			expect(purchaseHistoryRepo.getAll()).toHaveLength(3);
		});

		it('should strip non-numeric characters from prices', async () => {
			receiptExtractor.setDefaultData({
				items: [{ name: 'Item', quantity: '1', price: '$12.99 USD' }]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const items = receiptItemRepo.getAllStored();
			expect(items[0].price).toBe('12.99');
		});

		it('should strip non-numeric characters from total amount', async () => {
			receiptExtractor.setDefaultData({
				total: '£55.42',
				items: [{ name: 'Item', quantity: '1' }]
			});

			const file = createFakeFile('receipt.jpg');
			const receipt = await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			const stored = receiptRepo.getStored(receipt.id);
			expect(stored!.totalAmount).toBe('55.42');
		});

		it('should work without a job queue (direct execution)', async () => {
			// Create controller without job queue
			const controllerNoQueue = new ReceiptController(
				storageService,
				receiptExtractor,
				normalizationService,
				productNormalizer,
				pantryService,
				receiptRepo,
				receiptItemRepo,
				purchaseHistoryRepo
				// no jobQueue
			);

			receiptExtractor.setDefaultData({
				items: [{ name: 'Apple', quantity: '3' }]
			});

			const file = createFakeFile('receipt.jpg');
			const receipt = await controllerNoQueue.uploadReceipt({ userId, file });
			// Without job queue, fire-and-forget task() is called directly
			await flushMicrotasks();

			const stored = receiptRepo.getStored(receipt.id);
			expect(stored!.status).toBe('DONE');
			expect(receiptItemRepo.getAllStored()).toHaveLength(1);
		});

		it('should filter out non-food items', async () => {
			// Set up mocks for food and non-food items
			productNormalizer.setMock('Milk', {
				normalizedName: 'Milk',
				productGroup: 'Dairy',
				category: 'dairy',
				isFoodItem: true
			});

			productNormalizer.setMock('Dish Soap', {
				normalizedName: 'Dish Soap',
				productGroup: 'Cleaning',
				category: 'household',
				isFoodItem: false
			});

			receiptExtractor.setDefaultData({
				items: [
					{ name: 'Milk', quantity: '1', price: '$3.99' },
					{ name: 'Dish Soap', quantity: '1', price: '$2.99' }
				]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			// Only Milk should be saved, Dish Soap should be filtered out
			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(1);
			expect(items[0].normalizedName).toBe('Milk');
			expect(items[0].category).toBe('dairy');
		});

		it('should filter out all items when all are non-food', async () => {
			// Set up mocks for non-food items
			productNormalizer.setMock('Toilet Paper', {
				normalizedName: 'Toilet Paper',
				productGroup: 'Paper Products',
				category: 'household',
				isFoodItem: false
			});

			productNormalizer.setMock('Shampoo', {
				normalizedName: 'Shampoo',
				productGroup: 'Personal Care',
				category: 'toiletries',
				isFoodItem: false
			});

			receiptExtractor.setDefaultData({
				items: [
					{ name: 'Toilet Paper', quantity: '1', price: '$5.99' },
					{ name: 'Shampoo', quantity: '1', price: '$4.99' }
				]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			// No items should be saved
			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(0);

			// Receipt should still be marked as DONE
			const stored = receiptRepo.getStored((await receiptRepo.findByUserId(userId, 1))[0].id);
			expect(stored!.status).toBe('DONE');
		});

		it('should save all items when all are food items', async () => {
			// Set up mocks for food items
			productNormalizer.setMock('Bread', {
				normalizedName: 'Bread',
				productGroup: 'Bakery',
				category: 'bakery',
				isFoodItem: true
			});

			productNormalizer.setMock('Butter', {
				normalizedName: 'Butter',
				productGroup: 'Dairy',
				category: 'dairy',
				isFoodItem: true
			});

			productNormalizer.setMock('Eggs', {
				normalizedName: 'Eggs',
				productGroup: 'Dairy',
				category: 'dairy',
				isFoodItem: true
			});

			receiptExtractor.setDefaultData({
				items: [
					{ name: 'Bread', quantity: '1', price: '$2.99' },
					{ name: 'Butter', quantity: '1', price: '$3.99' },
					{ name: 'Eggs', quantity: '12', price: '$4.99' }
				]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			// All items should be saved
			const items = receiptItemRepo.getAllStored();
			expect(items).toHaveLength(3);
			expect(items.map((i) => i.normalizedName).sort()).toEqual(['Bread', 'Butter', 'Eggs']);
		});

		it('should not create purchase history for filtered non-food items', async () => {
			// Set up mocks
			productNormalizer.setMock('Apples', {
				normalizedName: 'Apples',
				productGroup: 'Produce',
				category: 'produce',
				isFoodItem: true
			});

			productNormalizer.setMock('Laundry Detergent', {
				normalizedName: 'Laundry Detergent',
				productGroup: 'Cleaning',
				category: 'household',
				isFoodItem: false
			});

			receiptExtractor.setDefaultData({
				purchaseDate: '2025-06-01',
				items: [
					{ name: 'Apples', quantity: '5', price: '$3.99' },
					{ name: 'Laundry Detergent', quantity: '1', price: '$12.99' }
				]
			});

			const file = createFakeFile('receipt.jpg');
			await controller.uploadReceipt({ userId, file });
			await flushMicrotasks();

			// Only Apples should be in purchase history
			const history = purchaseHistoryRepo.getAll();
			expect(history).toHaveLength(1);
			expect(history[0].itemName).toBe('Apples');
		});
	});

	// ---------- getReceipt ----------

	describe('getReceipt', () => {
		it('should return receipt with items for the correct user', async () => {
			// Seed a receipt and items
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Milk',
				normalizedName: 'milk',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT',
				category: 'dairy'
			});

			const result = await controller.getReceipt(receipt.id, userId);

			expect(result).not.toBeNull();
			expect(result!.id).toBe(receipt.id);
			expect(result!.items).toHaveLength(1);
			expect(result!.items[0].normalizedName).toBe('milk');
		});

		it('should return null for a different user', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const result = await controller.getReceipt(receipt.id, otherUserId);
			expect(result).toBeNull();
		});

		it('should return null for non-existent receipt', async () => {
			const result = await controller.getReceipt('non-existent-id', userId);
			expect(result).toBeNull();
		});
	});

	// ---------- getReceiptStatus ----------

	describe('getReceiptStatus', () => {
		it('should return status for own receipt', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'PROCESSING'
			});

			const result = await controller.getReceiptStatus(receipt.id, userId);
			expect(result).toEqual({ status: 'PROCESSING', errorMessage: null });
		});

		it('should return error message for failed receipt', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'QUEUED'
			});
			await receiptRepo.update(receipt.id, {
				status: 'FAILED',
				errorMessage: 'OCR timeout'
			});

			const result = await controller.getReceiptStatus(receipt.id, userId);
			expect(result).toEqual({ status: 'FAILED', errorMessage: 'OCR timeout' });
		});

		it('should return null for another user receipt', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const result = await controller.getReceiptStatus(receipt.id, otherUserId);
			expect(result).toBeNull();
		});

		it('should return null for non-existent receipt', async () => {
			const result = await controller.getReceiptStatus('no-such-id', userId);
			expect(result).toBeNull();
		});
	});

	// ---------- getUserReceipts ----------

	describe('getUserReceipts', () => {
		it('should return all receipts with items for a user', async () => {
			const receipt1 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r1.jpg',
				status: 'DONE'
			});
			await receiptItemRepo.create({
				receiptId: receipt1.id,
				rawName: 'Milk',
				normalizedName: 'milk',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			const receipt2 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r2.jpg',
				status: 'DONE'
			});
			await receiptItemRepo.create({
				receiptId: receipt2.id,
				rawName: 'Bread',
				normalizedName: 'bread',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			const results = await controller.getUserReceipts(userId);
			expect(results).toHaveLength(2);
			// Each receipt should have its items
			const allItemNames = results.flatMap((r) => r.items.map((i) => i.normalizedName));
			expect(allItemNames).toContain('milk');
			expect(allItemNames).toContain('bread');
		});

		it('should not return receipts belonging to other users', async () => {
			await receiptRepo.create({
				userId: otherUserId,
				imageUrl: 'mock://receipts/other.jpg',
				status: 'DONE'
			});

			const results = await controller.getUserReceipts(userId);
			expect(results).toHaveLength(0);
		});

		it('should respect the limit parameter', async () => {
			for (let i = 0; i < 5; i++) {
				await receiptRepo.create({
					userId,
					imageUrl: `mock://receipts/r${i}.jpg`,
					status: 'DONE'
				});
			}

			const results = await controller.getUserReceipts(userId, 3);
			expect(results).toHaveLength(3);
		});

		it('should return empty array for user with no receipts', async () => {
			const results = await controller.getUserReceipts(userId);
			expect(results).toEqual([]);
		});
	});

	// ---------- deleteReceipt ----------

	describe('deleteReceipt', () => {
		it('should delete receipt from storage and database', async () => {
			// Upload an image first so storage has the file
			storageService.upload(Buffer.from('data'), 'test.jpg', 'image/jpeg', 'receipts');

			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			await controller.deleteReceipt(receipt.id, userId);

			expect(receiptRepo.getStored(receipt.id)).toBeUndefined();
		});

		it('should throw for non-existent receipt', async () => {
			await expect(controller.deleteReceipt('no-such-id', userId)).rejects.toThrow(
				'Receipt not found'
			);
		});

		it('should throw when deleting another user receipt', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			await expect(controller.deleteReceipt(receipt.id, otherUserId)).rejects.toThrow(
				'Receipt not found'
			);
		});

		it('should handle deletion when imageUrl has no path segments gracefully', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'https://example.com/receipts/img.jpg',
				status: 'DONE'
			});

			// Should not throw even if storage.delete fails
			await controller.deleteReceipt(receipt.id, userId);
			expect(receiptRepo.getStored(receipt.id)).toBeUndefined();
		});
	});

	// ---------- updateReceiptItem ----------

	describe('updateReceiptItem', () => {
		it('should normalize and update an existing item', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Mlk',
				normalizedName: 'mlk',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			const updated = await controller.updateReceiptItem(receipt.id, userId, item.id, {
				name: 'Whole Milk',
				quantity: '2 lbs',
				price: '$5.99',
				category: 'dairy'
			});

			expect(updated.rawName).toBe('Whole Milk');
			expect(updated.normalizedName).toBe('whole milk');
			// NormalizationService converts 2 lbs → 907.184 g
			expect(parseFloat(updated.quantity)).toBeCloseTo(907.184, 1);
			expect(updated.unit).toBe('g');
			expect(updated.unitType).toBe('WEIGHT');
			expect(updated.price).toBe('5.99');
			expect(updated.category).toBe('dairy');
		});

		it('should use provided unit over normalized unit when specified', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Sugar',
				normalizedName: 'sugar',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			const updated = await controller.updateReceiptItem(receipt.id, userId, item.id, {
				name: 'Sugar',
				quantity: '500',
				unit: 'grams'
			});

			expect(updated.unit).toBe('grams');
		});

		it('should throw when receipt belongs to another user', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Test',
				normalizedName: 'test',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			await expect(
				controller.updateReceiptItem(receipt.id, otherUserId, item.id, {
					name: 'Updated',
					quantity: '1'
				})
			).rejects.toThrow('Receipt not found');
		});

		it('should throw when item does not belong to the receipt', async () => {
			const receipt1 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r1.jpg',
				status: 'DONE'
			});
			const receipt2 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r2.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt2.id,
				rawName: 'Wrong Receipt Item',
				normalizedName: 'wrong receipt item',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			await expect(
				controller.updateReceiptItem(receipt1.id, userId, item.id, {
					name: 'Updated',
					quantity: '1'
				})
			).rejects.toThrow('Item not found');
		});

		it('should throw when item does not exist', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			await expect(
				controller.updateReceiptItem(receipt.id, userId, 'non-existent-item', {
					name: 'Updated',
					quantity: '1'
				})
			).rejects.toThrow('Item not found');
		});

		it('should handle null price by setting it to null', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Test',
				normalizedName: 'test',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT',
				price: '5.00'
			});

			const updated = await controller.updateReceiptItem(receipt.id, userId, item.id, {
				name: 'Test',
				quantity: '1',
				price: null
			});

			expect(updated.price).toBeNull();
		});

		it('should default category to "other" when not provided', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Test',
				normalizedName: 'test',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT',
				category: 'dairy'
			});

			const updated = await controller.updateReceiptItem(receipt.id, userId, item.id, {
				name: 'Test',
				quantity: '1'
			});

			expect(updated.category).toBe('other');
		});
	});

	// ---------- addManualItem ----------

	describe('addManualItem', () => {
		it('should create a new item on the receipt with normalized data', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const item = await controller.addManualItem(receipt.id, userId, {
				name: 'Fresh Bananas',
				quantity: '6',
				category: 'produce'
			});

			expect(item.receiptId).toBe(receipt.id);
			expect(item.rawName).toBe('Fresh Bananas');
			expect(item.normalizedName).toBe('bananas');
			expect(item.quantity).toBe('6');
			expect(item.unitType).toBe('COUNT');
			expect(item.category).toBe('produce');
		});

		it('should normalize quantity with units', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const item = await controller.addManualItem(receipt.id, userId, {
				name: 'Flour',
				quantity: '2 kg',
				price: '$4.50'
			});

			// NormalizationService converts 2 kg → 2000 g
			expect(item.quantity).toBe('2000');
			expect(item.unit).toBe('g');
			expect(item.unitType).toBe('WEIGHT');
			expect(item.price).toBe('4.50');
		});

		it('should throw when receipt belongs to another user', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			await expect(
				controller.addManualItem(receipt.id, otherUserId, {
					name: 'Item',
					quantity: '1'
				})
			).rejects.toThrow('Receipt not found');
		});

		it('should throw for non-existent receipt', async () => {
			await expect(
				controller.addManualItem('no-such-receipt', userId, {
					name: 'Item',
					quantity: '1'
				})
			).rejects.toThrow('Receipt not found');
		});

		it('should default category to "other" when not provided', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const item = await controller.addManualItem(receipt.id, userId, {
				name: 'Mystery Item',
				quantity: '1'
			});

			expect(item.category).toBe('other');
		});

		it('should use provided unit over normalized unit', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			const item = await controller.addManualItem(receipt.id, userId, {
				name: 'Rice',
				quantity: '500',
				unit: 'grams'
			});

			expect(item.unit).toBe('grams');
		});
	});

	// ---------- deleteReceiptItem ----------

	describe('deleteReceiptItem', () => {
		it('should delete an item from the receipt', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Milk',
				normalizedName: 'milk',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			await controller.deleteReceiptItem(receipt.id, userId, item.id);

			expect(receiptItemRepo.getStored(item.id)).toBeUndefined();
		});

		it('should throw when receipt belongs to another user', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt.id,
				rawName: 'Test',
				normalizedName: 'test',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			await expect(controller.deleteReceiptItem(receipt.id, otherUserId, item.id)).rejects.toThrow(
				'Receipt not found'
			);
		});

		it('should throw when item does not belong to receipt', async () => {
			const receipt1 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r1.jpg',
				status: 'DONE'
			});
			const receipt2 = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/r2.jpg',
				status: 'DONE'
			});
			const item = await receiptItemRepo.create({
				receiptId: receipt2.id,
				rawName: 'Wrong',
				normalizedName: 'wrong',
				quantity: '1',
				unit: 'count',
				unitType: 'COUNT'
			});

			await expect(controller.deleteReceiptItem(receipt1.id, userId, item.id)).rejects.toThrow(
				'Item not found'
			);
		});

		it('should throw when item does not exist', async () => {
			const receipt = await receiptRepo.create({
				userId,
				imageUrl: 'mock://receipts/test.jpg',
				status: 'DONE'
			});

			await expect(
				controller.deleteReceiptItem(receipt.id, userId, 'no-such-item')
			).rejects.toThrow('Item not found');
		});

		it('should throw for non-existent receipt', async () => {
			await expect(
				controller.deleteReceiptItem('no-such-receipt', userId, 'some-item')
			).rejects.toThrow('Receipt not found');
		});
	});

	// ---------- getRecipeCountsByReceiptIds ----------

	describe('getRecipeCountsByReceiptIds', () => {
		it('should return an empty object (placeholder implementation)', async () => {
			const result = await controller.getRecipeCountsByReceiptIds(['id1', 'id2']);
			expect(result).toEqual({});
		});
	});
});
