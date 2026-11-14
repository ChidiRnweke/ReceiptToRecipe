import type { PurchaseHistoryDao, NewPurchaseHistoryDao, UpdatePurchaseHistoryDao } from '../daos';

export interface IPurchaseHistoryRepository {
	findById(id: string): Promise<PurchaseHistoryDao | null>;
	findByHouseholdId(householdId: string): Promise<PurchaseHistoryDao[]>;
	findByHouseholdAndItem(householdId: string, itemName: string): Promise<PurchaseHistoryDao | null>;
	create(history: NewPurchaseHistoryDao): Promise<PurchaseHistoryDao>;
	update(id: string, history: UpdatePurchaseHistoryDao): Promise<PurchaseHistoryDao>;
	delete(id: string): Promise<void>;
	markDepleted(id: string): Promise<PurchaseHistoryDao>;
	clearDepleted(id: string): Promise<PurchaseHistoryDao>;
	countActiveByHouseholdId(householdId: string): Promise<number>;
}
