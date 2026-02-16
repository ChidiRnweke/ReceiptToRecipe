import type { IPantryService, PantryItem, ConfidenceFactors } from '$services';
import type {
	IPurchaseHistoryRepository,
	IReceiptItemRepository,
	ICupboardItemRepository,
	IShoppingListRepository,
	IShoppingListItemRepository
} from '$repositories';

export interface CupboardStats {
	totalItems: number;
	inStock: number;
	runningLow: number;
	needsRestock: number;
	lastStocked: Date | null;
}

export interface AddManualItemInput {
	itemName: string;
	quantity?: string | null;
	unit?: string | null;
	category?: string | null;
	shelfLifeDays?: number | null;
	notes?: string | null;
}

export interface UpdateItemInput {
	quantity?: string | null;
	category?: string | null;
	shelfLifeDays?: number | null;
	notes?: string | null;
}

export class PantryController {
	constructor(
		private pantryService: IPantryService,
		private purchaseHistoryRepository: IPurchaseHistoryRepository,
		private receiptItemRepository: IReceiptItemRepository,
		private cupboardItemRepository: ICupboardItemRepository,
		private shoppingListRepository?: IShoppingListRepository,
		private shoppingListItemRepository?: IShoppingListItemRepository
	) {}

	/**
	 * Build all pantry items (both receipt + manual) with confidence scores.
	 * Skips depleted items. Does NOT apply a confidence threshold — callers filter.
	 */
	private async buildAllItems(userId: string): Promise<PantryItem[]> {
		const pantryItems: PantryItem[] = [];

		// 1. Fetch receipt-sourced items from purchase history (non-depleted)
		const history = await this.purchaseHistoryRepository.findByUserId(userId);

		for (const record of history) {
			if (record.isDepleted) continue;

			const quantity = record.userQuantityOverride
				? parseFloat(record.userQuantityOverride)
				: record.avgQuantity
					? parseFloat(record.avgQuantity)
					: 1;

			const overrides = {
				userOverrideDate: record.userOverrideDate ?? undefined,
				userShelfLifeDays: record.userShelfLifeDays ?? undefined,
				userQuantityOverride: quantity
			};

			// Find the latest receipt item for category/unit details
			const detail = await this.receiptItemRepository.findLatestByNormalizedName(
				userId,
				record.itemName
			);

			const category = detail?.category || null;

			const { confidence, factors } = this.pantryService.calculateStockConfidenceWithOverrides(
				record.lastPurchased,
				record.avgFrequencyDays,
				category,
				quantity,
				overrides
			);

			pantryItems.push({
				id: record.id,
				itemName: record.itemName,
				lastPurchased: record.lastPurchased,
				quantity: record.userQuantityOverride || record.avgQuantity || '1',
				unit: detail?.unit || 'unit',
				category,
				stockConfidence: confidence,
				estimatedDepleteDate: record.estimatedDepleteDate,
				daysSincePurchase: Math.floor(
					(Date.now() - (record.userOverrideDate ?? record.lastPurchased).getTime()) /
						(1000 * 60 * 60 * 24)
				),
				source: 'receipt',
				userOverrideDate: record.userOverrideDate,
				userShelfLifeDays: record.userShelfLifeDays,
				userQuantityOverride: record.userQuantityOverride,
				isDepleted: record.isDepleted,
				confidenceFactors: {
					...factors,
					purchaseCount: record.purchaseCount
				}
			});
		}

		// 2. Fetch manual cupboard items (non-depleted)
		const manualItems = await this.cupboardItemRepository.findByUserId(userId);

		for (const item of manualItems) {
			const quantity = item.quantity ? parseFloat(item.quantity) : 1;
			const overrides = {
				userShelfLifeDays: item.shelfLifeDays ?? undefined,
				userQuantityOverride: quantity
			};

			const { confidence, factors } = this.pantryService.calculateStockConfidenceWithOverrides(
				item.addedDate,
				null,
				item.category,
				quantity,
				overrides
			);

			pantryItems.push({
				id: item.id,
				itemName: item.itemName,
				lastPurchased: item.addedDate,
				quantity: item.quantity || '1',
				unit: item.unit || 'unit',
				category: item.category,
				stockConfidence: confidence,
				estimatedDepleteDate: this.pantryService.calculateDepletionDate(
					item.addedDate,
					null,
					item.category
				),
				daysSincePurchase: Math.floor(
					(Date.now() - item.addedDate.getTime()) / (1000 * 60 * 60 * 24)
				),
				source: 'manual',
				userShelfLifeDays: item.shelfLifeDays,
				isDepleted: item.isDepleted,
				confidenceFactors: factors
			});
		}

		return pantryItems;
	}

	/**
	 * Get the unified cupboard: merges receipt-sourced purchase history with manual cupboard items.
	 * Returns items above 0.2 confidence, sorted by confidence descending.
	 */
	async getUserPantry(userId: string): Promise<PantryItem[]> {
		const allItems = await this.buildAllItems(userId);
		return allItems
			.filter((item) => item.stockConfidence > 0.2)
			.sort((a, b) => b.stockConfidence - a.stockConfidence);
	}

	/**
	 * Get expired items — confidence has decayed to ≤0.2.
	 * These are shown in a separate "Expired" section so users can rescue
	 * (confirm still in stock) or dismiss them (mark as used up).
	 */
	async getExpiredItems(userId: string): Promise<PantryItem[]> {
		const allItems = await this.buildAllItems(userId);
		return allItems
			.filter((item) => item.stockConfidence <= 0.2)
			.sort((a, b) => b.lastPurchased.getTime() - a.lastPurchased.getTime());
	}

	/**
	 * Add a manually-entered item to the cupboard
	 */
	async addManualItem(userId: string, input: AddManualItemInput): Promise<PantryItem> {
		const created = await this.cupboardItemRepository.create({
			userId,
			itemName: input.itemName,
			quantity: input.quantity,
			unit: input.unit,
			category: input.category,
			shelfLifeDays: input.shelfLifeDays,
			notes: input.notes
		});

		const quantity = created.quantity ? parseFloat(created.quantity) : 1;
		const overrides = {
			userShelfLifeDays: created.shelfLifeDays ?? undefined,
			userQuantityOverride: quantity
		};

		const { confidence, factors } = this.pantryService.calculateStockConfidenceWithOverrides(
			created.addedDate,
			null,
			created.category,
			quantity,
			overrides
		);

		return {
			id: created.id,
			itemName: created.itemName,
			lastPurchased: created.addedDate,
			quantity: created.quantity || '1',
			unit: created.unit || 'unit',
			category: created.category,
			stockConfidence: confidence,
			estimatedDepleteDate: this.pantryService.calculateDepletionDate(
				created.addedDate,
				null,
				created.category
			),
			daysSincePurchase: 0,
			source: 'manual',
			userShelfLifeDays: created.shelfLifeDays,
			isDepleted: false,
			confidenceFactors: factors
		};
	}

	/**
	 * Mark an item as "used up" (soft delete)
	 */
	async markItemUsedUp(itemId: string, source: 'receipt' | 'manual'): Promise<void> {
		if (source === 'manual') {
			await this.cupboardItemRepository.markDepleted(itemId);
		} else {
			await this.purchaseHistoryRepository.markDepleted(itemId);
		}
	}

	/**
	 * Confirm an item is still in stock (resets confidence clock)
	 */
	async confirmItemInStock(itemId: string, source: 'receipt' | 'manual'): Promise<void> {
		if (source === 'manual') {
			// For manual items, reset the added_date to now
			await this.cupboardItemRepository.update(itemId, {
				isDepleted: false
			});
		} else {
			// For receipt items, set the override date to now
			await this.purchaseHistoryRepository.update(itemId, {
				userOverrideDate: new Date(),
				isDepleted: false
			});
		}
	}

	/**
	 * Update item details (quantity, category, shelf life, notes)
	 */
	async updateItem(
		itemId: string,
		source: 'receipt' | 'manual',
		input: UpdateItemInput
	): Promise<void> {
		if (source === 'manual') {
			await this.cupboardItemRepository.update(itemId, {
				quantity: input.quantity,
				category: input.category,
				shelfLifeDays: input.shelfLifeDays,
				notes: input.notes
			});
		} else {
			// For receipt-sourced items, use override fields
			await this.purchaseHistoryRepository.update(itemId, {
				userQuantityOverride: input.quantity,
				userShelfLifeDays: input.shelfLifeDays
			});
		}
	}

	/**
	 * Delete a manual cupboard item permanently
	 */
	async deleteManualItem(itemId: string): Promise<void> {
		await this.cupboardItemRepository.delete(itemId);
	}

	/**
	 * Get summary statistics for the cupboard
	 */
	async getCupboardStats(userId: string): Promise<CupboardStats> {
		const items = await this.getUserPantry(userId);

		let lastStocked: Date | null = null;
		let inStock = 0;
		let runningLow = 0;
		let needsRestock = 0;

		for (const item of items) {
			if (item.stockConfidence > 0.7) {
				inStock++;
			} else if (item.stockConfidence > 0.4) {
				runningLow++;
			} else {
				needsRestock++;
			}

			if (!lastStocked || item.lastPurchased > lastStocked) {
				lastStocked = item.lastPurchased;
			}
		}

		return {
			totalItems: items.length,
			inStock,
			runningLow,
			needsRestock,
			lastStocked
		};
	}

	/**
	 * Get total count of active cupboard items (for nav badge).
	 * Uses the same confidence-filtered logic as getUserPantry() so the badge
	 * count matches the actual number of visible items.
	 */
	async getCupboardCount(userId: string): Promise<number> {
		const items = await this.getUserPantry(userId);
		return items.length;
	}

	/**
	 * Add a cupboard item to the user's active shopping list.
	 * Creates a new list if none exists.
	 */
	async addToShoppingList(
		userId: string,
		itemName: string,
		quantity?: string | null,
		unit?: string | null
	): Promise<void> {
		if (!this.shoppingListRepository || !this.shoppingListItemRepository) {
			throw new Error('Shopping list repositories not available');
		}

		// Get or create the active shopping list
		const existingList = await this.shoppingListRepository.findActiveByUserId(userId);
		let listId: string;
		if (existingList) {
			listId = existingList.id;
		} else {
			const newList = await this.shoppingListRepository.create({
				userId,
				name: 'Shopping List',
				isActive: true
			});
			listId = newList.id;
		}

		// Add the item
		const maxOrder = await this.shoppingListItemRepository.getMaxOrderIndex(listId);
		await this.shoppingListItemRepository.create({
			shoppingListId: listId,
			name: itemName,
			quantity: quantity || null,
			unit: unit || null,
			notes: 'Added from Cupboard',
			orderIndex: maxOrder + 1
		});
	}
}
