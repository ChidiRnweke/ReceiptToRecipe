/**
 * Pure calculation functions for pantry/stock management
 * These functions have no side effects and are easily testable
 */

/**
 * Calculate stock confidence (0.0 to 1.0) based on days since purchase
 * 
 * @param daysSincePurchase - Number of days since item was purchased
 * @param estimatedLifespan - Expected lifespan in days (from frequency or category)
 * @param quantity - Quantity purchased (affects confidence boost)
 * @returns Confidence score between 0.0 and 1.0
 */
export function calculateStockConfidencePure(
	daysSincePurchase: number,
	estimatedLifespan: number,
	quantity: number = 1
): number {
	// If purchased today or in future, full confidence
	if (daysSincePurchase <= 0) return 1.0;

	// Linear decay: 1.0 at day 0, 0.0 at estimatedLifespan
	let confidence = 1.0 - (daysSincePurchase / estimatedLifespan);

	// Quantity modifier: Larger quantities extend confidence slightly
	if (quantity > 1) {
		confidence += (Math.log(quantity) * 0.1); // Small boost
	}

	// Clamp between 0 and 1
	return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate estimated depletion date
 * 
 * @param lastPurchased - Date when item was last purchased
 * @param lifespan - Expected lifespan in days
 * @returns Date when stock is expected to deplete
 */
export function calculateDepletionDatePure(
	lastPurchased: Date,
	lifespan: number
): Date {
	const depletionDate = new Date(lastPurchased);
	depletionDate.setDate(depletionDate.getDate() + lifespan);
	return depletionDate;
}

/**
 * Get default shelf life in days for a category
 * 
 * @param category - Product category string
 * @returns Shelf life in days
 */
export function getShelfLifePure(category: string | null): number {
	const DEFAULT_SHELF_LIVES: Record<string, number> = {
		produce: 7,
		dairy: 10,
		meat: 5,
		seafood: 3,
		pantry: 90,
		frozen: 60,
		canned: 365,
		bakery: 4,
		beverages: 180,
		snacks: 60,
		household: 730,
		other: 14
	};

	if (!category) return 14;
	const normalized = category.toLowerCase();
	
	// Check explicit map
	if (DEFAULT_SHELF_LIVES[normalized]) {
		return DEFAULT_SHELF_LIVES[normalized];
	}

	// Fuzzy match
	if (normalized.includes('vegetable') || normalized.includes('fruit')) return 7;
	if (normalized.includes('milk') || normalized.includes('yogurt') || normalized.includes('cheese')) return 10;
	if (normalized.includes('meat') || normalized.includes('chicken') || normalized.includes('fish')) return 5;
	if (normalized.includes('bread')) return 4;
	
	return 14;
}
