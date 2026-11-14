import { v4 as uuid } from 'uuid';
import type { IPurchaseHistoryRepository } from '../../src/lib/repositories/interfaces/IPurchaseHistoryRepository';
import type {
	PurchaseHistoryDao,
	NewPurchaseHistoryDao,
	UpdatePurchaseHistoryDao
} from '../../src/lib/repositories/daos';

export class MockPurchaseHistoryRepository implements IPurchaseHistoryRepository {
	private store = new Map<string, PurchaseHistoryDao>();

	async findById(id: string): Promise<PurchaseHistoryDao | null> {
		return this.store.get(id) || null;
	}

	async findByHouseholdId(householdId: string): Promise<PurchaseHistoryDao[]> {
		return [...this.store.values()]
			.filter((h) => h.householdId === householdId)
			.sort((a, b) => b.lastPurchased.getTime() - a.lastPurchased.getTime());
	}

	async findByHouseholdAndItem(
		householdId: string,
		itemName: string
	): Promise<PurchaseHistoryDao | null> {
		for (const record of this.store.values()) {
			if (record.householdId === householdId && record.itemName === itemName) {
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
			householdId: history.householdId,
			itemName: history.itemName,
			lastPurchased: history.lastPurchased,
			purchaseCount: history.purchaseCount ?? 1,
			avgQuantity: history.avgQuantity ?? null,
			avgFrequencyDays: history.avgFrequencyDays ?? null,
			estimatedDepleteDate: history.estimatedDepleteDate ?? null,
			userOverrideDate: null,
			userShelfLifeDays: null,
			userQuantityOverride: null,
			isDepleted: false,
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

	async delete(id: string): Promise<void> {
		this.store.delete(id);
	}

	async markDepleted(id: string): Promise<PurchaseHistoryDao> {
		const existing = this.store.get(id);
		if (!existing) throw new Error('Purchase history not found');

		const updated: PurchaseHistoryDao = {
			...existing,
			isDepleted: true,
			updatedAt: new Date()
		};
		this.store.set(id, updated);
		return updated;
	}

	async clearDepleted(id: string): Promise<PurchaseHistoryDao> {
		const existing = this.store.get(id);
		if (!existing) throw new Error('Purchase history not found');

		const updated: PurchaseHistoryDao = {
			...existing,
			isDepleted: false,
			userOverrideDate: null,
			updatedAt: new Date()
		};
		this.store.set(id, updated);
		return updated;
	}

	async countActiveByHouseholdId(householdId: string): Promise<number> {
		return [...this.store.values()].filter((h) => h.householdId === householdId && !h.isDepleted)
			.length;
	}

	// Test helpers
	clear(): void {
		this.store.clear();
	}

	getAll(): PurchaseHistoryDao[] {
		return [...this.store.values()];
	}
}
