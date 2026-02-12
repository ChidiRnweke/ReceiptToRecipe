import { v4 as uuid } from 'uuid';
import type {
	IPurchaseHistoryRepository
} from '../../src/lib/repositories/interfaces/IPurchaseHistoryRepository';
import type {
	PurchaseHistoryDao,
	NewPurchaseHistoryDao,
	UpdatePurchaseHistoryDao,
	SmartSuggestionDao
} from '../../src/lib/repositories/daos';

export class MockPurchaseHistoryRepository implements IPurchaseHistoryRepository {
	private store = new Map<string, PurchaseHistoryDao>();

	async findById(id: string): Promise<PurchaseHistoryDao | null> {
		return this.store.get(id) || null;
	}

	async findByUserId(userId: string): Promise<PurchaseHistoryDao[]> {
		return [...this.store.values()]
			.filter(h => h.userId === userId)
			.sort((a, b) => b.lastPurchased.getTime() - a.lastPurchased.getTime());
	}

	async findByUserAndItem(userId: string, itemName: string): Promise<PurchaseHistoryDao | null> {
		for (const record of this.store.values()) {
			if (record.userId === userId && record.itemName === itemName) {
				return record;
			}
		}
		return null;
	}

	async create(history: NewPurchaseHistoryDao): Promise<PurchaseHistoryDao> {
		const now = new Date();
		const record: PurchaseHistoryDao = {
			id: uuid(),
			userId: history.userId,
			itemName: history.itemName,
			lastPurchased: history.lastPurchased,
			purchaseCount: history.purchaseCount ?? 1,
			avgQuantity: history.avgQuantity ?? null,
			avgFrequencyDays: history.avgFrequencyDays ?? null,
			estimatedDepleteDate: history.estimatedDepleteDate ?? null,
			createdAt: now,
			updatedAt: now
		};
		this.store.set(record.id, record);
		return record;
	}

	async update(id: string, history: UpdatePurchaseHistoryDao): Promise<PurchaseHistoryDao> {
		const existing = this.store.get(id);
		if (!existing) throw new Error('Purchase history not found');

		const updated: PurchaseHistoryDao = {
			...existing,
			...history,
			updatedAt: new Date()
		};
		this.store.set(id, updated);
		return updated;
	}

	async findSuggestions(userId: string, limit: number): Promise<SmartSuggestionDao[]> {
		const history = await this.findByUserId(userId);
		const now = new Date();
		const suggestions: SmartSuggestionDao[] = [];

		for (const item of history) {
			const daysSinceLastPurchase = Math.floor(
				(now.getTime() - item.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
			);

			if (item.avgFrequencyDays && daysSinceLastPurchase >= item.avgFrequencyDays * 0.8) {
				suggestions.push({
					itemName: item.itemName,
					lastPurchased: item.lastPurchased,
					avgFrequencyDays: item.avgFrequencyDays,
					daysSinceLastPurchase,
					suggestedQuantity: item.avgQuantity
				});
			}
		}

		return suggestions
			.sort((a, b) => {
				const aOverdue = a.avgFrequencyDays ? a.daysSinceLastPurchase / a.avgFrequencyDays : 0;
				const bOverdue = b.avgFrequencyDays ? b.daysSinceLastPurchase / b.avgFrequencyDays : 0;
				return bOverdue - aOverdue;
			})
			.slice(0, limit);
	}

	// Test helpers
	clear(): void {
		this.store.clear();
	}

	getAll(): PurchaseHistoryDao[] {
		return [...this.store.values()];
	}
}
