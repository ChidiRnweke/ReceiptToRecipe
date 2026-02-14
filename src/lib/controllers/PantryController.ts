import type { IPantryService, PantryItem } from '$services';
import type { IPurchaseHistoryRepository, IReceiptItemRepository } from '$repositories';

export class PantryController {
	constructor(
		private pantryService: IPantryService,
		private purchaseHistoryRepository: IPurchaseHistoryRepository,
		private receiptItemRepository: IReceiptItemRepository
	) {}

	async getUserPantry(userId: string): Promise<PantryItem[]> {
		// 1. Fetch purchase history
		const history = await this.purchaseHistoryRepository.findByUserId(userId);

		// 2. Convert to PantryItems and calculate confidence
		const pantryItems: PantryItem[] = [];

		for (const record of history) {
			// Calculate confidence
			const confidence = this.pantryService.calculateStockConfidence(
				record.lastPurchased,
				record.avgFrequencyDays,
				null, // Category not stored in purchaseHistory - fetched below
				record.avgQuantity ? parseFloat(record.avgQuantity) : 1
			);

			if (confidence > 0.2) {
				// Find the latest receipt item for this product to get category/unit details
				const detail = await this.receiptItemRepository.findLatestByNormalizedName(
					userId,
					record.itemName
				);

				// Recalculate confidence with category if available
				const finalConfidence = detail?.category
					? this.pantryService.calculateStockConfidence(
							record.lastPurchased,
							record.avgFrequencyDays,
							detail.category,
							record.avgQuantity ? parseFloat(record.avgQuantity) : 1
						)
					: confidence;

				if (finalConfidence > 0.2) {
					pantryItems.push({
						id: detail?.id,
						itemName: record.itemName,
						lastPurchased: record.lastPurchased,
						quantity: record.avgQuantity || '1',
						unit: detail?.unit || 'unit',
						category: detail?.category || null,
						stockConfidence: finalConfidence,
						estimatedDepleteDate: record.estimatedDepleteDate,
						daysSincePurchase: Math.floor(
							(Date.now() - record.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
						),
						source: 'receipt'
					});
				}
			}
		}

		// Sort by confidence descending
		return pantryItems.sort((a, b) => b.stockConfidence - a.stockConfidence);
	}
}
