import type { PurchaseHistory } from '$db/schema';
import {
	calculateStockConfidencePure,
	calculateDepletionDatePure,
	getShelfLifePure
} from './pantryCalculations';

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

		// Get lifespan from frequency or category
		const estimatedLifespan = avgFrequencyDays || this.getShelfLife(category);

		// Use pure function for calculation
		return calculateStockConfidencePure(daysSincePurchase, estimatedLifespan, quantity);
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
		return calculateDepletionDatePure(lastPurchased, lifespan);
	}

	getShelfLife(category: string | null): number {
		return getShelfLifePure(category);
	}
}
