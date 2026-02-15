export interface PurchaseHistoryDao {
	id: string;
	userId: string;
	itemName: string;
	lastPurchased: Date;
	purchaseCount: number;
	avgQuantity: string | null;
	avgFrequencyDays: number | null;
	estimatedDepleteDate: Date | null;
	userOverrideDate: Date | null;
	userShelfLifeDays: number | null;
	userQuantityOverride: string | null;
	isDepleted: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewPurchaseHistoryDao {
	userId: string;
	itemName: string;
	lastPurchased: Date;
	purchaseCount?: number;
	avgQuantity?: string | null;
	avgFrequencyDays?: number | null;
	estimatedDepleteDate?: Date | null;
}

export interface UpdatePurchaseHistoryDao {
	lastPurchased?: Date;
	purchaseCount?: number;
	avgQuantity?: string | null;
	avgFrequencyDays?: number | null;
	estimatedDepleteDate?: Date | null;
	userOverrideDate?: Date | null;
	userShelfLifeDays?: number | null;
	userQuantityOverride?: string | null;
	isDepleted?: boolean;
}

export interface SmartSuggestionDao {
	itemName: string;
	lastPurchased: Date;
	avgFrequencyDays: number | null;
	daysSinceLastPurchase: number;
	suggestedQuantity: string | null;
}
