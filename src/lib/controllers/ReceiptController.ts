import type {
	IStorageService,
	IReceiptExtractor,
	INormalizationService,
	IProductNormalizer,
	RawReceiptData,
	IPantryService,
	IKitchenService
} from '$services';
import { dayNumber } from '$lib/services/kitchen';
import type {
	IReceiptRepository,
	IReceiptItemRepository,
	IPurchaseHistoryRepository,
	ReceiptDao,
	ReceiptItemDao,
	NewReceiptItemDao,
	ReceiptWithItemsDao,
	ReceiptListItemDao
} from '$repositories';
import type { Actor } from '$lib/models/household';

export interface UploadReceiptInput {
	actor: Actor;
	file: File;
	/** The open shopping list items at the moment of the photo, kept to match the receipt to. */
	listSnapshot?: ReceiptListItemDao[];
}

export type ReceiptWithItems = ReceiptWithItemsDao;

/** The storage key of an uploaded receipt photo: its folder and file name, e.g. `receipts/x.jpg`. */
function storageKeyOf(imageUrl: string): string {
	return imageUrl.split('/').slice(-2).join('/');
}

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
		private kitchenService: IKitchenService,
		private jobQueue?: {
			add: (job: { name?: string; run: () => Promise<void> }) => Promise<void>;
		}
	) {}

	/**
	 * Upload a receipt image and start async OCR processing
	 */
	async uploadReceipt(input: UploadReceiptInput): Promise<ReceiptDao> {
		const { actor, file, listSnapshot } = input;

		// Upload image to storage
		const buffer = Buffer.from(await file.arrayBuffer());
		const mimeType = file.type;
		const uploadResult = await this.storageService.upload(buffer, file.name, mimeType, 'receipts');

		// Create receipt record with QUEUED status
		const receipt = await this.receiptRepository.create({
			userId: actor.userId,
			householdId: actor.householdId,
			imageUrl: uploadResult.url,
			status: 'QUEUED',
			listSnapshot
		});

		// Background OCR processing - pass the original buffer so OCR
		// doesn't need to fetch from an internal/proxy URL
		this.queueOcr(receipt, actor.timeZone, buffer, mimeType);

		return receipt;
	}

	/**
	 * Queues OCR again for receipts a restart left QUEUED or PROCESSING. The job queue lives in
	 * memory, so a restart loses its jobs; the photo is read back from storage. A receipt whose
	 * photo cannot be read is marked FAILED, so its page stops waiting. Returns the receipt ids
	 * that were queued again.
	 */
	async resumePendingReceipts(): Promise<string[]> {
		const pending = await this.receiptRepository.findByStatuses(['QUEUED', 'PROCESSING']);
		const resumed: string[] = [];
		for (const receipt of pending) {
			const file = await this.storageService
				.read(storageKeyOf(receipt.imageUrl))
				.catch((error: unknown) => error as Error);
			if (file instanceof Error) {
				await this.receiptRepository.update(receipt.id, {
					status: 'FAILED',
					errorMessage: `The photo could not be read again after a restart: ${file.message}`
				});
				continue;
			}
			const timeZone = await this.kitchenService.timeZoneOf(receipt.householdId);
			this.queueOcr(receipt, timeZone, file.data, file.contentType);
			resumed.push(receipt.id);
		}
		return resumed;
	}

	private queueOcr(receipt: ReceiptDao, timeZone: string, buffer: Buffer, mimeType: string): void {
		const task = () =>
			this.processReceiptOcr(receipt.id, receipt.householdId, timeZone, buffer, mimeType).catch(
				(error) => {
					console.error(`OCR processing failed for receipt ${receipt.id}:`, error);
				}
			);

		if (this.jobQueue) {
			this.jobQueue.add({ name: `receipt:${receipt.id}`, run: task }).catch((error) => {
				console.error('Failed to enqueue OCR job', error);
				task();
			});
		} else {
			task();
		}
	}

	/**
	 * Background OCR processing. Uses the raw image buffer directly so OCR doesn't need to fetch
	 * from an internal MinIO URL or a proxy URL.
	 *
	 * Safe to run again for the same receipt, as `resumePendingReceipts` does after a crash part
	 * of the way through:
	 * - The lines are replaced, never added to, and the BOUGHT events of the lines they replace
	 *   are forgotten first, so the receipt keeps one set of lines with one BOUGHT each.
	 * - The SHOP_DONE and the purchase history are written by the one reading that claims the
	 *   receipt's `shopRecordedAt` mark. A crash after the claim loses them rather than doubling
	 *   them: a missed count is harmless, a double count teaches wrong habits.
	 */
	private async processReceiptOcr(
		receiptId: string,
		householdId: string,
		/** The household's time zone: the job counts days between purchases in it. */
		timeZone: string,
		imageBuffer: Buffer,
		mimeType: string
	): Promise<void> {
		try {
			const receipt = await this.receiptRepository.findById(receiptId);
			if (!receipt) {
				throw new Error('Receipt not found');
			}

			// Use receipt upload date (createdAt) as the purchase date
			const purchaseDate = receipt.createdAt;
			const author = { userId: receipt.userId, householdId };

			await this.receiptRepository.update(receiptId, {
				status: 'PROCESSING'
			});

			// Extract data via OCR using the buffer directly
			const ocrData = await this.receiptExtractor.extractReceiptFromBuffer(imageBuffer, mimeType);

			const foodItems = await this.normalizeLines(receiptId, ocrData);
			const earlier = await this.receiptItemRepository.findByReceiptId(receiptId);
			await this.kitchenService.forgetReceiptItems(
				householdId,
				earlier.map((item) => item.id)
			);
			const savedItems = await this.receiptItemRepository.replaceForReceipt(receiptId, foodItems);
			await this.kitchenService.recordBought(
				author,
				savedItems.map((item) => this.toBoughtItem(item)),
				purchaseDate,
				'receipt'
			);

			if (await this.receiptRepository.claimShopRecording(receiptId, new Date())) {
				await this.updatePurchaseHistory(author, foodItems, purchaseDate, timeZone);
				await this.kitchenService.recordShopClosed({
					author,
					method: 'RECEIPT',
					itemCount: savedItems.length,
					at: purchaseDate,
					details: { receiptId }
				});
			}

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

	private toBoughtItem(item: ReceiptItemDao) {
		return {
			name: item.normalizedName,
			quantity: parseFloat(item.quantity),
			unit: item.unit,
			category: item.category,
			receiptItemId: item.id
		};
	}

	/** The receipt's food lines, normalized. */
	private async normalizeLines(
		receiptId: string,
		ocrData: RawReceiptData
	): Promise<NewReceiptItemDao[]> {
		const lines = await Promise.all(
			(ocrData.items || []).map(async (item) => {
				const nameStr = typeof item.name === 'string' ? item.name : String(item.name || '');
				const rawName = nameStr.trim() || 'Unknown Item';

				const normalized = this.normalizationService.normalizeQuantity(item.quantity || '1');

				// Use AI for advanced product normalization
				const productInfo = await this.productNormalizer.normalizeProduct(rawName);

				const line: NewReceiptItemDao = {
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
					productGroup: productInfo.productGroup
				};
				return { line, isFoodItem: productInfo.isFoodItem };
			})
		);
		return lines.filter((entry) => entry.isFoodItem).map((entry) => entry.line);
	}

	/**
	 * Update purchase history for smart shopping list suggestions
	 */
	private async updatePurchaseHistory(
		author: { userId: string; householdId: string },
		items: NewReceiptItemDao[],
		purchaseDate: Date,
		timeZone: string
	): Promise<void> {
		for (const item of items) {
			const existing = await this.purchaseHistoryRepository.findByHouseholdAndItem(
				author.householdId,
				item.normalizedName
			);

			// Calculate depletion date using PantryService
			const estimatedDepleteDate = this.pantryService.calculateDepletionDate(
				purchaseDate,
				existing?.avgFrequencyDays || null,
				item.category || null
			);

			if (existing) {
				// Calculate new average frequency, in the household's local calendar days
				const daysSinceLastPurchase =
					dayNumber(purchaseDate, timeZone) - dayNumber(existing.lastPurchased, timeZone);

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
					userId: author.userId,
					householdId: author.householdId,
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
	async getReceipt(receiptId: string, actor: Actor): Promise<ReceiptWithItems | null> {
		const receipt = await this.receiptRepository.findByIdWithItems(receiptId);

		if (!receipt || receipt.householdId !== actor.householdId) {
			return null;
		}

		return receipt;
	}

	/**
	 * Get receipt status (for polling)
	 */
	async getReceiptStatus(
		receiptId: string,
		actor: Actor
	): Promise<{ status: string; errorMessage?: string | null } | null> {
		const receipt = await this.receiptRepository.findById(receiptId);
		if (!receipt || receipt.householdId !== actor.householdId) return null;

		return {
			status: receipt.status,
			errorMessage: receipt.errorMessage
		};
	}

	/**
	 * Get the household's receipts
	 */
	async getHouseholdReceipts(actor: Actor, limit: number = 20): Promise<ReceiptWithItemsDao[]> {
		return this.receiptRepository.findByHouseholdIdWithItems(actor.householdId, limit);
	}

	/**
	 * Delete a receipt
	 */
	async deleteReceipt(receiptId: string, actor: Actor): Promise<void> {
		const receipt = await this.receiptRepository.findByIdWithItems(receiptId);

		if (!receipt || receipt.householdId !== actor.householdId) {
			throw new Error('Receipt not found');
		}

		// Clean up purchase history for each item on this receipt
		for (const item of receipt.items) {
			await this.removePurchaseHistoryForItem(actor.householdId, item.normalizedName);
		}
		await this.kitchenService.forgetReceiptItems(
			actor.householdId,
			receipt.items.map((item) => item.id)
		);

		// Delete from storage
		if (receipt.imageUrl) {
			await this.storageService.delete(storageKeyOf(receipt.imageUrl)).catch(console.error);
		}

		// Delete from database (cascade will handle receipt_items)
		await this.receiptRepository.delete(receiptId);
	}

	/**
	 * Update a single receipt item
	 */
	async updateReceiptItem(
		receiptId: string,
		actor: Actor,
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

		if (!receipt || receipt.householdId !== actor.householdId) {
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

		// The corrected line replaces what the kitchen log recorded for it.
		await this.kitchenService.forgetReceiptItems(actor.householdId, [itemId]);
		await this.kitchenService.recordBought(
			actor,
			[this.toBoughtItem(updated)],
			receipt.purchaseDate ?? receipt.createdAt,
			'receipt'
		);

		return updated;
	}

	async addManualItem(
		receiptId: string,
		actor: Actor,
		data: {
			name: string;
			quantity: string;
			unit?: string;
			price?: string | null;
			category?: string | null;
		}
	): Promise<ReceiptItemDao> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt || receipt.householdId !== actor.householdId) {
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

		await this.kitchenService.recordBought(
			actor,
			[this.toBoughtItem(created)],
			receipt.purchaseDate ?? receipt.createdAt,
			'receipt'
		);

		return created;
	}

	async deleteReceiptItem(receiptId: string, actor: Actor, itemId: string): Promise<void> {
		const receipt = await this.receiptRepository.findById(receiptId);

		if (!receipt || receipt.householdId !== actor.householdId) {
			throw new Error('Receipt not found');
		}

		// Verify item belongs to receipt
		const existingItem = await this.receiptItemRepository.findById(itemId);
		if (!existingItem || existingItem.receiptId !== receiptId) {
			throw new Error('Item not found');
		}

		// Clean up purchase history for this item
		await this.removePurchaseHistoryForItem(actor.householdId, existingItem.normalizedName);
		await this.kitchenService.forgetReceiptItems(actor.householdId, [itemId]);

		await this.receiptItemRepository.delete(itemId);
	}

	/**
	 * Remove or decrement purchase history when a receipt/item is deleted.
	 * If the item was only purchased once, delete the history record entirely.
	 * If purchased multiple times, decrement the purchase count.
	 */
	private async removePurchaseHistoryForItem(
		householdId: string,
		normalizedName: string
	): Promise<void> {
		const history = await this.purchaseHistoryRepository.findByHouseholdAndItem(
			householdId,
			normalizedName
		);

		if (!history) return;

		if (history.purchaseCount <= 1) {
			await this.purchaseHistoryRepository.delete(history.id);
		} else {
			await this.purchaseHistoryRepository.update(history.id, {
				purchaseCount: history.purchaseCount - 1
			});
		}
	}

	async getRecipeCountsByReceiptIds(): Promise<Record<string, number>> {
		// Implementation placeholder if needed
		return {};
	}
}
