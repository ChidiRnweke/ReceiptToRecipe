export interface PurchaseHistoryDao {
	id: string;
	userId: string;
	householdId: string;
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
	householdId: string;
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
