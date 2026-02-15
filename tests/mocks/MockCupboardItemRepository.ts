import { v4 as uuid } from 'uuid';
import type { ICupboardItemRepository } from '../../src/lib/repositories/interfaces/ICupboardItemRepository';
import type {
	CupboardItemDao,
	NewCupboardItemDao,
	UpdateCupboardItemDao
} from '../../src/lib/repositories/daos';

export class MockCupboardItemRepository implements ICupboardItemRepository {
	private store = new Map<string, CupboardItemDao>();

	async findByUserId(userId: string): Promise<CupboardItemDao[]> {
		return [...this.store.values()]
			.filter((item) => item.userId === userId && !item.isDepleted)
			.sort((a, b) => b.addedDate.getTime() - a.addedDate.getTime());
	}

	async findById(id: string): Promise<CupboardItemDao | null> {
		return this.store.get(id) || null;
	}

	async findByUserAndItem(userId: string, itemName: string): Promise<CupboardItemDao | null> {
		for (const item of this.store.values()) {
			if (item.userId === userId && item.itemName === itemName) {
				return item;
			}
		}
		return null;
	}

	async create(item: NewCupboardItemDao): Promise<CupboardItemDao> {
		const now = new Date();
		const record: CupboardItemDao = {
			id: uuid(),
			userId: item.userId,
			itemName: item.itemName,
			quantity: item.quantity ?? null,
			unit: item.unit ?? null,
			category: item.category ?? null,
			addedDate: item.addedDate ?? now,
			shelfLifeDays: item.shelfLifeDays ?? null,
			isDepleted: false,
			notes: item.notes ?? null,
			createdAt: now,
			updatedAt: now
		};
		this.store.set(record.id, record);
		return record;
	}

	async update(id: string, data: UpdateCupboardItemDao): Promise<CupboardItemDao> {
		const existing = this.store.get(id);
		if (!existing) throw new Error('Cupboard item not found');

		const updated: CupboardItemDao = {
			...existing,
			...data,
			updatedAt: new Date()
		};
		this.store.set(id, updated);
		return updated;
	}

	async markDepleted(id: string): Promise<CupboardItemDao> {
		const existing = this.store.get(id);
		if (!existing) throw new Error('Cupboard item not found');

		const updated: CupboardItemDao = {
			...existing,
			isDepleted: true,
			updatedAt: new Date()
		};
		this.store.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.store.delete(id);
	}

	async countByUserId(userId: string): Promise<number> {
		return [...this.store.values()].filter((item) => item.userId === userId && !item.isDepleted)
			.length;
	}

	// Test helpers
	clear(): void {
		this.store.clear();
	}

	getAll(): CupboardItemDao[] {
		return [...this.store.values()];
	}

	getStored(id: string): CupboardItemDao | undefined {
		return this.store.get(id);
	}
}
