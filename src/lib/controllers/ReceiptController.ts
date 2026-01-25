import { db } from '$db/client';
import { receipts, receiptItems, purchaseHistory } from '$db/schema';
import type { Receipt, ReceiptItem, NewReceipt, NewReceiptItem } from '$db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { IStorageService, IOcrService, INormalizationService, RawReceiptData, PantryService } from '$services';

export interface UploadReceiptInput {
	userId: string;
	file: File;
}

export interface ReceiptWithItems extends Receipt {
	items: ReceiptItem[];
}

export class ReceiptController {
	constructor(
		private storageService: IStorageService,
		private ocrService: IOcrService,
		private normalizationService: INormalizationService,
		private pantryService: PantryService,
		private jobQueue?: { add: (job: { name?: string; run: () => Promise<void> }) => Promise<void> }
	) {}

	/**
	 * Upload a receipt image and start async OCR processing
	 */
	async uploadReceipt(input: UploadReceiptInput): Promise<Receipt> {
		const { userId, file } = input;

		// Upload image to storage
		const buffer = Buffer.from(await file.arrayBuffer());
		const uploadResult = await this.storageService.upload(
			buffer,
			file.name,
			file.type,
			'receipts'
		);

		// Create receipt record with QUEUED status
		const [receipt] = await db
			.insert(receipts)
			.values({
				userId,
				imageUrl: uploadResult.url,
				status: 'QUEUED'
			})
			.returning();


		// Background OCR processing
		const task = () =>
			this.processReceiptOcr(receipt.id, uploadResult.url).catch((error) => {
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
	 * Background OCR processing
	 */
	private async processReceiptOcr(receiptId: string, imageUrl: string): Promise<void> {
		try {
			// Update status to PROCESSING
			await db.update(receipts).set({ status: 'PROCESSING' }).where(eq(receipts.id, receiptId));

			// Extract data via OCR
			const ocrData = await this.ocrService.extractReceipt(imageUrl);

			// Normalize and save items
			await this.saveReceiptData(receiptId, ocrData);

			// Update status to DONE
			await db
				.update(receipts)
				.set({
					status: 'DONE',
					rawOcrData: ocrData,
					storeName: ocrData.storeName,
					purchaseDate: ocrData.purchaseDate ? new Date(ocrData.purchaseDate) : undefined,
					totalAmount: ocrData.total?.replace(/[^0-9.]/g, '') || undefined,
					updatedAt: new Date()
				})
				.where(eq(receipts.id, receiptId));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			await db
				.update(receipts)
				.set({
					status: 'FAILED',
					errorMessage,
					updatedAt: new Date()
				})
				.where(eq(receipts.id, receiptId));
		}
	}

	/**
	 * Save normalized receipt items
	 */
	private async saveReceiptData(receiptId: string, ocrData: RawReceiptData): Promise<void> {
		const receipt = await db.query.receipts.findFirst({
			where: eq(receipts.id, receiptId)
		});

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		const normalizedItems: NewReceiptItem[] = ocrData.items.map((item) => {
			const normalized = this.normalizationService.normalizeQuantity(item.quantity || '1');
			const normalizedName = this.normalizationService.normalizeName(item.name);

			return {
				receiptId,
				rawName: item.name,
				normalizedName,
				quantity: normalized.value.toString(),
				unit: normalized.unit,
				unitType: normalized.unitType,
				price: item.price?.replace(/[^0-9.]/g, '') || undefined,
				category: item.category || 'other'
			};
		});

		if (normalizedItems.length > 0) {
			await db.insert(receiptItems).values(normalizedItems);

			// Update purchase history
			const purchaseDate = ocrData.purchaseDate ? new Date(ocrData.purchaseDate) : new Date();
			await this.updatePurchaseHistory(receipt.userId, normalizedItems, purchaseDate);
		}
	}

	/**
	 * Update purchase history for smart shopping list suggestions
	 */
	private async updatePurchaseHistory(
		userId: string,
		items: NewReceiptItem[],
		purchaseDate: Date
	): Promise<void> {
		for (const item of items) {
			const existing = await db.query.purchaseHistory.findFirst({
				where: and(
					eq(purchaseHistory.userId, userId),
					eq(purchaseHistory.itemName, item.normalizedName)
				)
			});

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
				const newLastPurchased = purchaseDate > existing.lastPurchased ? purchaseDate : existing.lastPurchased;
				
				// If updating lastPurchased, we should also update estimatedDepleteDate based on the new date
				const finalDepleteDate = purchaseDate > existing.lastPurchased 
					? estimatedDepleteDate 
					: existing.estimatedDepleteDate;

				await db
					.update(purchaseHistory)
					.set({
						lastPurchased: newLastPurchased,
						purchaseCount: existing.purchaseCount + 1,
						avgFrequencyDays: newFrequency,
						avgQuantity: newAvgQty,
						estimatedDepleteDate: finalDepleteDate,
						updatedAt: new Date()
					})
					.where(eq(purchaseHistory.id, existing.id));
			} else {
				await db.insert(purchaseHistory).values({
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
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId)),
			with: {
				items: true
			}
		});

		return receipt || null;
	}

	/**
	 * Get receipt status (for polling)
	 */
	async getReceiptStatus(
		receiptId: string,
		userId: string
	): Promise<{ status: string; errorMessage?: string | null } | null> {
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId)),
			columns: {
				status: true,
				errorMessage: true
			}
		});

		return receipt || null;
	}

	/**
	 * Get all receipts for a user
	 */
	async getUserReceipts(userId: string, limit: number = 20): Promise<Receipt[]> {
		return db.query.receipts.findMany({
			where: eq(receipts.userId, userId),
			orderBy: [desc(receipts.createdAt)],
			limit
		});
	}

	/**
	 * Delete a receipt
	 */
	async deleteReceipt(receiptId: string, userId: string): Promise<void> {
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId))
		});

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		// Delete from storage
		if (receipt.imageUrl) {
			const key = receipt.imageUrl.split('/').slice(-2).join('/');
			await this.storageService.delete(key).catch(console.error);
		}

		// Delete from database (cascade will handle items)
		await db.delete(receipts).where(eq(receipts.id, receiptId));
	}

	/**
	 * Update a single receipt item
	 */
	async updateReceiptItem(receiptId: string, userId: string, itemId: string, data: {
		name: string;
		quantity: string;
		unit?: string;
		price?: string | null;
		category?: string | null;
	}): Promise<ReceiptItem> {
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId))
		});

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		const normalized = this.normalizationService.normalizeQuantity(data.quantity || '1');
		const normalizedName = this.normalizationService.normalizeName(data.name);

		const [updated] = await db
			.update(receiptItems)
			.set({
				rawName: data.name,
				normalizedName,
				quantity: normalized.value.toString(),
				unit: data.unit || normalized.unit,
				unitType: normalized.unitType,
				price: data.price?.replace(/[^0-9.]/g, '') || null,
				category: data.category || 'other'
			})
			.where(and(eq(receiptItems.id, itemId), eq(receiptItems.receiptId, receiptId)))
			.returning();

		if (!updated) {
			throw new Error('Item not found');
		}

		return updated;
	}

	async addManualItem(receiptId: string, userId: string, data: {
		name: string;
		quantity: string;
		unit?: string;
		price?: string | null;
		category?: string | null;
	}): Promise<ReceiptItem> {
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId))
		});

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		const normalized = this.normalizationService.normalizeQuantity(data.quantity || '1');
		const normalizedName = this.normalizationService.normalizeName(data.name);

		const [created] = await db
			.insert(receiptItems)
			.values({
				receiptId,
				rawName: data.name,
				normalizedName,
				quantity: normalized.value.toString(),
				unit: data.unit || normalized.unit,
				unitType: normalized.unitType,
				price: data.price?.replace(/[^0-9.]/g, '') || null,
				category: data.category || 'other'
			})
			.returning();

		return created;
	}

	async deleteReceiptItem(receiptId: string, userId: string, itemId: string): Promise<void> {
		const receipt = await db.query.receipts.findFirst({
			where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId))
		});

		if (!receipt) {
			throw new Error('Receipt not found');
		}

		await db.delete(receiptItems).where(and(eq(receiptItems.id, itemId), eq(receiptItems.receiptId, receiptId)));
	}
}
