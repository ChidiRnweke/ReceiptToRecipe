import type {
	PurchaseHistoryDao,
	NewPurchaseHistoryDao,
	UpdatePurchaseHistoryDao,
	SmartSuggestionDao
} from '../daos';

export interface IPurchaseHistoryRepository {
	findById(id: string): Promise<PurchaseHistoryDao | null>;
	findByUserId(userId: string): Promise<PurchaseHistoryDao[]>;
	findByUserAndItem(userId: string, itemName: string): Promise<PurchaseHistoryDao | null>;
	create(history: NewPurchaseHistoryDao): Promise<PurchaseHistoryDao>;
	update(id: string, history: UpdatePurchaseHistoryDao): Promise<PurchaseHistoryDao>;
	delete(id: string): Promise<void>;
	findSuggestions(userId: string, limit: number): Promise<SmartSuggestionDao[]>;
	markDepleted(id: string): Promise<PurchaseHistoryDao>;
	clearDepleted(id: string): Promise<PurchaseHistoryDao>;
	countActiveByUserId(userId: string): Promise<number>;
}
