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
}

export interface IPantryService {
	calculateStockConfidence(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null,
		quantity: number
	): number;
	calculateDepletionDate(
		lastPurchased: Date,
		avgFrequencyDays: number | null,
		category: string | null
	): Date;
	getShelfLife(category: string | null): number;
}
