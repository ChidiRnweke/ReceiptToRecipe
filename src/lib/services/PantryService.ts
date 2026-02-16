import type { ConfidenceFactors, StockOverrides } from './interfaces/IPantryService';
import {
	calculateStockConfidencePure,
	calculateDepletionDatePure,
	getShelfLifePure
} from './pantryCalculations';

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
	 * Calculate stock confidence with user overrides, returning both confidence and breakdown factors
	 */
	calculateStockConfidenceWithOverrides(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity: number = 1,
		overrides: StockOverrides = {}
	): { confidence: number; factors: ConfidenceFactors } {
		const now = new Date();

		// Determine effective date (user override takes priority)
		const effectiveDate = overrides.userOverrideDate ?? lastPurchased;
		const daysSincePurchase = Math.floor(
			(now.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		// Determine effective lifespan and its source
		let effectiveLifespanDays: number;
		let lifespanSource: ConfidenceFactors['lifespanSource'];

		const categoryShelfLife = this.getShelfLife(category);

		if (overrides.userShelfLifeDays != null) {
			effectiveLifespanDays = overrides.userShelfLifeDays;
			lifespanSource = 'user_override';
		} else if (avgFrequencyDays != null) {
			// Cap purchase frequency to 3x the category shelf life to prevent
			// nonsensical values from corrupted/hallucinated purchase dates
			const maxReasonableLifespan = categoryShelfLife * 3;
			if (avgFrequencyDays <= maxReasonableLifespan) {
				effectiveLifespanDays = avgFrequencyDays;
				lifespanSource = 'purchase_frequency';
			} else {
				effectiveLifespanDays = categoryShelfLife;
				lifespanSource = 'category_default';
			}
		} else if (category) {
			effectiveLifespanDays = categoryShelfLife;
			lifespanSource = 'category_default';
		} else {
			effectiveLifespanDays = this.getShelfLife(null);
			lifespanSource = 'global_default';
		}

		// Determine effective quantity
		const effectiveQuantity = overrides.userQuantityOverride ?? quantity;

		// Calculate confidence
		const confidence =
			daysSincePurchase <= 0
				? 1.0
				: calculateStockConfidencePure(daysSincePurchase, effectiveLifespanDays, effectiveQuantity);

		// Calculate quantity boost for transparency
		const quantityBoost = effectiveQuantity > 1 ? Math.log(effectiveQuantity) * 0.1 : 0;
		const baseConfidence =
			daysSincePurchase <= 0
				? 1.0
				: Math.max(0, Math.min(1, 1.0 - daysSincePurchase / effectiveLifespanDays));

		const factors: ConfidenceFactors = {
			effectiveDate,
			effectiveLifespanDays,
			lifespanSource,
			effectiveQuantity,
			quantityBoost,
			baseConfidence
		};

		return { confidence, factors };
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
