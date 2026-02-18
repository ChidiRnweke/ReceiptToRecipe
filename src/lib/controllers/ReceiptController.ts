import type {
	IStorageService,
	IReceiptExtractor,
	INormalizationService,
	IProductNormalizer,
	RawReceiptData,
	IPantryService
} from '$services';
import type {
	IReceiptRepository,
	IReceiptItemRepository,
	IPurchaseHistoryRepository,
	ReceiptDao,
	ReceiptItemDao,
	NewReceiptItemDao,
	ReceiptWithItemsDao
} from '$repositories';

export interface UploadReceiptInput {
	userId: string;
	file: File;
}

export interface ReceiptWithItems extends ReceiptWithItemsDao {}

export class ReceiptController {
	constructor(
		private storageService: IStorageService,
		private receiptExtractor: IReceiptExtractor,
		private normalizationService: INormalizationService,
		private productNormalizer: IProductNormalizer,
		private pantryService: IPantryService,
		private receiptRepository: IReceiptRepository,
		private receiptItemRepository: IReceiptItemRepository,
		private purchaseHistoryRepository: IPurchaseHistoryRepository,
		private jobQueue?: {
			add: (job: { name?: string; run: () => Promise<void> }) => Promise<void>;
		}
	) {}

	/**
	 * Upload a receipt image and start async OCR processing
	 */
	async uploadReceipt(input: UploadReceiptInput): Promise<ReceiptDao> {
		const { userId, file } = input;

		// Upload image to storage
		const buffer = Buffer.from(await file.arrayBuffer());
		const mimeType = file.type;
		const uploadResult = await this.storageService.upload(buffer, file.name, mimeType, 'receipts');

		// Create receipt record with QUEUED status
		const receipt = await this.receiptRepository.create({
			userId,
			imageUrl: uploadResult.url,
			status: 'QUEUED'
		});

		// Background OCR processing - pass the original buffer so OCR
		// doesn't need to fetch from an internal/proxy URL
		const task = () =>
			this.processReceiptOcr(receipt.id, buffer, mimeType).catch((error) => {
				console.error(`OCR processing failed for receipt ${receipt.id}:`, error);
			});

		if (this.jobQueue) {
			this.jobQueue.add({ name: `receipt:${receipt.id}`, run: task }).catch((error) => {
				console.error('Failed to enqueue OCR job', error);
				task();
			});
		} else {
			task();
		}

		return receipt;
	}

	/**
	 * Background OCR processing.
	 * Uses the raw image buffer directly so OCR doesn't need to fetch
	 * from an internal MinIO URL or a proxy URL.
	 */
	private async processReceiptOcr(
		receiptId: string,
		imageBuffer: Buffer,
		mimeType: string
	): Promise<void> {
		try {
			// Get receipt to access upload date
			const receipt = await this.receiptRepository.findById(receiptId);
			if (!receipt) {
				throw new Error('Receipt not found');
			}

			// Use receipt upload date (createdAt) as the purchase date
			const purchaseDate = receipt.createdAt;

			// Update status to PROCESSING
			await this.receiptRepository.update(receiptId, {
				status: 'PROCESSING'
			});

			// Extract data via OCR using the buffer directly
			const ocrData = await this.receiptExtractor.extractReceiptFromBuffer(imageBuffer, mimeType);
			console.log('OCR Data:', ocrData);

			// Normalize and save items
			await this.saveReceiptData(receiptId, ocrData, purchaseDate);

			// Update status to DONE
			await this.receiptRepository.update(receiptId, {
				status: 'DONE',
				rawOcrData: ocrData as unknown as Record<string, unknown>,
				storeName: ocrData.storeName,
				purchaseDate: purchaseDate,
				totalAmount: ocrData.total?.replace(/[^0-9.]/g, '') || undefined,
				currency: ocrData.currency || 'USD'
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			await this.receiptRepository.update(receiptId, {
				status: 'FAILED',
				errorMessage
			});
		}
	}

	/**
	 * Save normalized receipt items
	 */
	private async saveReceiptData(
		receiptId: string,
		ocrData: RawReceiptData,
		purchaseDate: Date
	): Promise<void> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		const allNormalizedItems: (NewReceiptItemDao & { isFoodItem: boolean })[] = await Promise.all(
			(ocrData.items || []).map(async (item) => {
				const nameStr = typeof item.name === 'string' ? item.name : String(item.name || '');
				const rawName = nameStr.trim() || 'Unknown Item';

				const normalized = this.normalizationService.normalizeQuantity(item.quantity || '1');

				// Use AI for advanced product normalization
				const productInfo = await this.productNormalizer.normalizeProduct(rawName);

				return {
					receiptId,
					rawName,
					normalizedName: productInfo.normalizedName,
					quantity: normalized.value.toString(),
					unit: normalized.unit, // Keep quantity unit from local normalization
					unitType: normalized.unitType,
					price:
						item.price && typeof item.price === 'string'
							? item.price.replace(/[^0-9.]/g, '')
							: undefined,
					category: productInfo.category || 'other',
					productGroup: productInfo.productGroup,
					isFoodItem: productInfo.isFoodItem
				};
			})
		);

		// Filter out non-food items
		const foodItems = allNormalizedItems.filter((item) => item.isFoodItem);

		if (foodItems.length > 0) {
			await this.receiptItemRepository.createMany(foodItems);

			// Update purchase history - use receipt upload date
			await this.updatePurchaseHistory(receipt.userId, foodItems, purchaseDate);
		}
	}

	/**
	 * Update purchase history for smart shopping list suggestions
	 */
	private async updatePurchaseHistory(
		userId: string,
		items: NewReceiptItemDao[],
		purchaseDate: Date
	): Promise<void> {
		for (const item of items) {
			const existing = await this.purchaseHistoryRepository.findByUserAndItem(
				userId,
				item.normalizedName
			);

			// Calculate depletion date using PantryService
			const estimatedDepleteDate = this.pantryService.calculateDepletionDate(
				purchaseDate,
				existing?.avgFrequencyDays || null,
				item.category || null
			);

			if (existing) {
				// Calculate new average frequency
				const daysSinceLastPurchase = Math.floor(
					(purchaseDate.getTime() - existing.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
				);

				// Only update frequency if the purchase is newer than the last one
				let newFrequency = existing.avgFrequencyDays;
				if (daysSinceLastPurchase > 0) {
					newFrequency = existing.avgFrequencyDays
						? Math.round((existing.avgFrequencyDays + daysSinceLastPurchase) / 2)
						: daysSinceLastPurchase;
				}

				// Calculate new average quantity
				const currentQty = parseFloat(item.quantity);
				const newAvgQty = existing.avgQuantity
					? ((parseFloat(existing.avgQuantity) + currentQty) / 2).toString()
					: item.quantity;

				// Don't update lastPurchased if we are processing an old receipt
				const newLastPurchased =
					purchaseDate > existing.lastPurchased ? purchaseDate : existing.lastPurchased;

				// If updating lastPurchased, we should also update estimatedDepleteDate based on the new date
				const finalDepleteDate =
					purchaseDate > existing.lastPurchased
						? estimatedDepleteDate
						: existing.estimatedDepleteDate;

				await this.purchaseHistoryRepository.update(existing.id, {
					lastPurchased: newLastPurchased,
					purchaseCount: existing.purchaseCount + 1,
					avgFrequencyDays: newFrequency,
					avgQuantity: newAvgQty,
					estimatedDepleteDate: finalDepleteDate,
					isDepleted: false
				});
			} else {
				await this.purchaseHistoryRepository.create({
					userId,
					itemName: item.normalizedName,
					lastPurchased: purchaseDate,
					purchaseCount: 1,
					avgQuantity: item.quantity,
					estimatedDepleteDate,
					avgFrequencyDays: null // Start with null until we have 2 purchases
				});
			}
		}
	}

	/**
	 * Get receipt by ID with items
	 */
	async getReceipt(receiptId: string, userId: string): Promise<ReceiptWithItems | null> {
		const receipt = await this.receiptRepository.findByIdWithItems(receiptId);

		if (!receipt || receipt.userId !== userId) {
			return null;
		}

		return receipt;
	}

	/**
	 * Get receipt status (for polling)
	 */
	async getReceiptStatus(
		receiptId: string,
		userId: string
	): Promise<{ status: string; errorMessage?: string | null } | null> {
		const receipt = await this.receiptRepository.findById(receiptId);
		if (!receipt || receipt.userId !== userId) return null;

		return {
			status: receipt.status,
			errorMessage: receipt.errorMessage
		};
	}

	/**
	 * Get all receipts for a user
	 */
	async getUserReceipts(userId: string, limit: number = 20): Promise<ReceiptWithItemsDao[]> {
		return this.receiptRepository.findByUserIdWithItems(userId, limit);
	}

	/**
	 * Delete a receipt
	 */
	async deleteReceipt(receiptId: string, userId: string): Promise<void> {
		const receipt = await this.receiptRepository.findByIdWithItems(receiptId);

		if (!receipt || receipt.userId !== userId) {
			throw new Error('Receipt not found');
		}

		// Clean up purchase history for each item on this receipt
		for (const item of receipt.items) {
			await this.removePurchaseHistoryForItem(userId, item.normalizedName);
		}

		// Delete from storage
		if (receipt.imageUrl) {
			const key = receipt.imageUrl.split('/').slice(-2).join('/');
			await this.storageService.delete(key).catch(console.error);
		}

		// Delete from database (cascade will handle receipt_items)
		await this.receiptRepository.delete(receiptId);
	}

	/**
	 * Update a single receipt item
	 */
	async updateReceiptItem(
		receiptId: string,
		userId: string,
		itemId: string,
		data: {
			name: string;
			quantity: string;
			unit?: string;
			price?: string | null;
			category?: string | null;
		}
	): Promise<ReceiptItemDao> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt || receipt.userId !== userId) {
			throw new Error('Receipt not found');
		}

		const normalized = this.normalizationService.normalizeQuantity(data.quantity || '1');
		const normalizedName = this.normalizationService.normalizeName(data.name);

		// Verify item belongs to receipt
		const existingItem = await this.receiptItemRepository.findById(itemId);
		if (!existingItem || existingItem.receiptId !== receiptId) {
			throw new Error('Item not found');
		}

		const updated = await this.receiptItemRepository.update(itemId, {
			rawName: data.name,
			normalizedName,
			quantity: normalized.value.toString(),
			unit: data.unit || normalized.unit,
			unitType: normalized.unitType,
			price: data.price?.replace(/[^0-9.]/g, '') || null,
			category: data.category || 'other'
		});

		return updated;
	}

	async addManualItem(
		receiptId: string,
		userId: string,
		data: {
			name: string;
			quantity: string;
			unit?: string;
			price?: string | null;
			category?: string | null;
		}
	): Promise<ReceiptItemDao> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt || receipt.userId !== userId) {
			throw new Error('Receipt not found');
		}

		const normalized = this.normalizationService.normalizeQuantity(data.quantity || '1');
		const normalizedName = this.normalizationService.normalizeName(data.name);

		const created = await this.receiptItemRepository.create({
			receiptId,
			rawName: data.name,
			normalizedName,
			quantity: normalized.value.toString(),
			unit: data.unit || normalized.unit,
			unitType: normalized.unitType,
			price: data.price?.replace(/[^0-9.]/g, '') || null,
			category: data.category || 'other'
		});

		return created;
	}

	async deleteReceiptItem(receiptId: string, userId: string, itemId: string): Promise<void> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt || receipt.userId !== userId) {
			throw new Error('Receipt not found');
		}

		// Verify item belongs to receipt
		const existingItem = await this.receiptItemRepository.findById(itemId);
		if (!existingItem || existingItem.receiptId !== receiptId) {
			throw new Error('Item not found');
		}

		// Clean up purchase history for this item
		await this.removePurchaseHistoryForItem(userId, existingItem.normalizedName);

		await this.receiptItemRepository.delete(itemId);
	}

	/**
	 * Remove or decrement purchase history when a receipt/item is deleted.
	 * If the item was only purchased once, delete the history record entirely.
	 * If purchased multiple times, decrement the purchase count.
	 */
	private async removePurchaseHistoryForItem(
		userId: string,
		normalizedName: string
	): Promise<void> {
		const history = await this.purchaseHistoryRepository.findByUserAndItem(userId, normalizedName);

		if (!history) return;

		if (history.purchaseCount <= 1) {
			await this.purchaseHistoryRepository.delete(history.id);
		} else {
			await this.purchaseHistoryRepository.update(history.id, {
				purchaseCount: history.purchaseCount - 1
			});
		}
	}

	async getRecipeCountsByReceiptIds(receiptIds: string[]): Promise<Record<string, number>> {
		// Implementation placeholder if needed
		return {};
	}
}
