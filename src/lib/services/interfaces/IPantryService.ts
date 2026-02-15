export interface PantryItem {
	id?: string;
	itemName: string;
	lastPurchased: Date;
	quantity: string;
	unit: string;
	category: string | null;
	stockConfidence: number;
	estimatedDepleteDate: Date | null;
	daysSincePurchase: number;
	source: 'receipt' | 'manual';
	// Override fields for cupboard transparency
	userOverrideDate?: Date | null;
	userShelfLifeDays?: number | null;
	userQuantityOverride?: string | null;
	isDepleted?: boolean;
	// Confidence breakdown for transparency
	confidenceFactors?: ConfidenceFactors;
}

export interface ConfidenceFactors {
	effectiveDate: Date;
	effectiveLifespanDays: number;
	lifespanSource: 'purchase_frequency' | 'user_override' | 'category_default' | 'global_default';
	effectiveQuantity: number;
	quantityBoost: number;
	baseConfidence: number;
	purchaseCount?: number;
}

export interface StockOverrides {
	userOverrideDate?: Date | null;
	userShelfLifeDays?: number | null;
	userQuantityOverride?: number | null;
}

export interface IPantryService {
	calculateStockConfidence(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity: number
	): number;
	calculateStockConfidenceWithOverrides(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity: number,
		overrides: StockOverrides
	): { confidence: number; factors: ConfidenceFactors };
	calculateDepletionDate(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null
	): Date;
	getShelfLife(category: string | null): number;
}
