import { db } from '$db/client';
import { purchaseHistory, receiptItems, receipts } from '$db/schema';
import { eq, desc, and, gt } from 'drizzle-orm';
import type { PantryService, PantryItem } from '$services';

export class PantryController {
	constructor(private pantryService: PantryService) {}

	async getUserPantry(userId: string): Promise<PantryItem[]> {
		// 1. Fetch purchase history
		const history = await db.query.purchaseHistory.findMany({
			where: eq(purchaseHistory.userId, userId)
		});

		// 2. Convert to PantryItems and calculate confidence
		const pantryItems: PantryItem[] = [];

		for (const record of history) {
			// Calculate confidence
			const confidence = this.pantryService.calculateStockConfidence(
				record.lastPurchased,
				record.avgFrequencyDays,
				null, // Category not stored in purchaseHistory? It's in receiptItems.
				record.avgQuantity ? parseFloat(record.avgQuantity) : 1
			);

			if (confidence > 0.2) {
				// We need category and unit from somewhere. 
				// Let's fetch the latest receipt item for details.
				// This acts as "provenance" and fills missing details.
				const lastItem = await db.query.receiptItems.findFirst({
					where: and(
						eq(receiptItems.normalizedName, record.itemName),
						// We might want to filter by userId indirectly via receipt? 
						// receiptItems doesn't have userId, but purchaseHistory does.
						// We need to join receipts.
					),
					with: {
						receipt: true
					},
					orderBy: [desc(receiptItems.createdAt)]
				});
                
                // Verify user ownership of the receipt item
                if (lastItem && lastItem.receipt.userId !== userId) {
                    continue; // Should not happen if normalized names are unique per user? 
                    // No, normalized names are just strings. purchaseHistory is per user.
                    // We must filter receiptItems by receipt.userId.
                }
                
                // Optimized query to get details + ownership check
                const details = await db
                    .select({
                        id: receiptItems.id,
                        unit: receiptItems.unit,
                        category: receiptItems.category,
                        storeName: receipts.storeName,
                        receiptId: receipts.id
                    })
                    .from(receiptItems)
                    .innerJoin(receipts, eq(receipts.id, receiptItems.receiptId))
                    .where(and(
                        eq(receipts.userId, userId),
                        eq(receiptItems.normalizedName, record.itemName)
                    ))
                    .orderBy(desc(receiptItems.createdAt))
                    .limit(1);

				const detail = details[0];

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
						id: detail?.id, // Representative ID
						itemName: record.itemName,
						lastPurchased: record.lastPurchased,
						quantity: record.avgQuantity || '1', // Estimated remaining? Or avg purchase size?
						unit: detail?.unit || 'unit',
						category: detail?.category || null,
						stockConfidence: finalConfidence,
						estimatedDepleteDate: record.estimatedDepleteDate,
						daysSincePurchase: Math.floor((Date.now() - record.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)),
						source: 'receipt'
					});
				}
			}
		}

		// Sort by confidence descending
		return pantryItems.sort((a, b) => b.stockConfidence - a.stockConfidence);
	}
}
