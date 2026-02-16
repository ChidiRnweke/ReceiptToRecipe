import type {
	IPantryService,
	PantryItem,
	ConfidenceFactors,
	StockOverrides
} from '../../src/lib/services/interfaces/IPantryService';
import {
	calculateStockConfidencePure,
	calculateDepletionDatePure,
	getShelfLifePure
} from '../../src/lib/services/pantryCalculations';

/**
 * Mock implementation of IPantryService for testing
 * Uses pure calculation functions
 */
export class MockPantryService implements IPantryService {
	calculateStockConfidence(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity?: number
	): number {
		const now = new Date();
		const daysSincePurchase = Math.floor(
			(now.getTime() - lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
		);
		const estimatedLifespan = avgFrequencyDays || this.getShelfLife(category);
		return calculateStockConfidencePure(daysSincePurchase, estimatedLifespan, quantity || 1);
	}

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
