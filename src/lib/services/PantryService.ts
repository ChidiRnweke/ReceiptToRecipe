import type { PurchaseHistory } from '$db/schema';

export interface PantryItem {
	id?: string; // Representative Receipt Item ID
	itemName: string;
	lastPurchased: Date;
	quantity: string;
	unit: string;
	category: string | null;
	stockConfidence: number; // 0.0 to 1.0
	estimatedDepleteDate: Date | null;
	daysSincePurchase: number;
	source: 'receipt' | 'manual';
}

export class PantryService {
	// Default shelf lives in days
	private static DEFAULT_SHELF_LIVES: Record<string, number> = {
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

	/**
	 * Calculate stock confidence (0.0 to 1.0) based on purchase date and frequency
	 */
	calculateStockConfidence(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity: number = 1
	): number {
		const now = new Date();
		const daysSincePurchase = Math.floor(
			(now.getTime() - lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
		);

		// If purchased today or in future, full confidence
		if (daysSincePurchase <= 0) return 1.0;

		// 1. Base decay based on frequency
		// If we don't have frequency data, assume category average or default 14 days
		const estimatedLifespan = avgFrequencyDays || this.getShelfLife(category);
		
		// Linear decay: 1.0 at day 0, 0.0 at estimatedLifespan
		let confidence = 1.0 - (daysSincePurchase / estimatedLifespan);

		// 2. Quantity modifier
		// Larger quantities might last longer, but usually frequency captures this.
		// However, buying 5 apples vs 1 apple means 5 apples last longer? 
		// Or does it mean you eat them faster?
		// For simplicity, let's boost confidence slightly for bulk buys if frequency is low.
		// Current plan: "Quantity factor: Larger quantities extend confidence"
		if (quantity > 1) {
			confidence += (Math.log(quantity) * 0.1); // Small boost
		}

		// Clamp
		return Math.max(0, Math.min(1, confidence));
	}

	/**
	 * Calculate estimated depletion date
	 */
	calculateDepletionDate(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null
	): Date {
		const lifespan = avgFrequencyDays || this.getShelfLife(category);
		const depletionDate = new Date(lastPurchased);
		depletionDate.setDate(depletionDate.getDate() + lifespan);
		return depletionDate;
	}

	private getShelfLife(category: string | null): number {
		if (!category) return 14;
		const normalized = category.toLowerCase();
		
		// Check explicit map
		if (PantryService.DEFAULT_SHELF_LIVES[normalized]) {
			return PantryService.DEFAULT_SHELF_LIVES[normalized];
		}

		// Fuzzy match
		if (normalized.includes('vegetable') || normalized.includes('fruit')) return 7;
		if (normalized.includes('milk') || normalized.includes('yogurt') || normalized.includes('cheese')) return 10;
		if (normalized.includes('meat') || normalized.includes('chicken') || normalized.includes('fish')) return 5;
		if (normalized.includes('bread')) return 4;
		
		return 14;
	}
}
