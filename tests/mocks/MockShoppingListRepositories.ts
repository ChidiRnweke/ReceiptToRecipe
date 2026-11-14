import type {
	IShoppingListRepository,
	IShoppingListItemRepository
} from '../../src/lib/repositories/interfaces/IShoppingListRepositories';
import type {
	ShoppingListDao,
	NewShoppingListDao,
	UpdateShoppingListDao,
	ShoppingListWithItemsDao,
	ShoppingListItemDao,
	NewShoppingListItemDao,
	UpdateShoppingListItemDao
} from '../../src/lib/repositories/daos';
import { v4 as uuidv4 } from 'uuid';
import { normalizeItemKey } from '../../src/lib/models/kitchen';

/**
 * Mock implementation of IShoppingListRepository for testing
 */
export class MockShoppingListRepository implements IShoppingListRepository {
	private lists = new Map<string, ShoppingListDao>();
	private itemRepo?: IShoppingListItemRepository;

	setItemRepository(itemRepo: IShoppingListItemRepository): void {
		this.itemRepo = itemRepo;
	}

	async findById(id: string): Promise<ShoppingListDao | null> {
		return this.lists.get(id) || null;
	}

	async findByIdWithItems(id: string): Promise<ShoppingListWithItemsDao | null> {
		const list = this.lists.get(id);
		if (!list) return null;

		let items: ShoppingListItemDao[] = [];
		if (this.itemRepo) {
			items = await this.itemRepo.findByListId(id);
		}

		return { ...list, items };
	}

	async findActiveByHouseholdId(householdId: string): Promise<ShoppingListWithItemsDao | null> {
		const list = Array.from(this.lists.values()).find(
			(l) => l.householdId === householdId && l.isActive
		);
		if (!list) return null;
		return this.findByIdWithItems(list.id);
	}

	async create(list: NewShoppingListDao): Promise<ShoppingListDao> {
		const now = new Date();
		const created: ShoppingListDao = {
			id: uuidv4(),
			userId: list.userId,
			householdId: list.householdId,
			name: list.name,
			isActive: list.isActive ?? true,
			createdAt: now,
			updatedAt: now
		};
		this.lists.set(created.id, created);
		return created;
	}

	async update(id: string, list: UpdateShoppingListDao): Promise<ShoppingListDao> {
		const existing = this.lists.get(id);
		if (!existing) throw new Error(`Shopping list ${id} not found`);

		const updated: ShoppingListDao = {
			...existing,
			...list,
			id: existing.id,
			userId: existing.userId,
			householdId: existing.householdId,
			createdAt: existing.createdAt,
			updatedAt: new Date()
		};
		this.lists.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.lists.delete(id);
	}

	// Test helpers
	getStored(id: string): ShoppingListDao | undefined {
		return this.lists.get(id);
	}

	getAllStored(): ShoppingListDao[] {
		return Array.from(this.lists.values());
	}

	clear(): void {
		this.lists.clear();
	}
}

/**
 * Mock implementation of IShoppingListItemRepository for testing
 */
export class MockShoppingListItemRepository implements IShoppingListItemRepository {
	private items = new Map<string, ShoppingListItemDao>();

	async findById(id: string): Promise<ShoppingListItemDao | null> {
		return this.items.get(id) || null;
	}

	async findByListId(listId: string): Promise<ShoppingListItemDao[]> {
		return Array.from(this.items.values())
			.filter((i) => i.shoppingListId === listId)
			.sort((a, b) => a.orderIndex - b.orderIndex);
	}

	async create(item: NewShoppingListItemDao): Promise<ShoppingListItemDao> {
		const created: ShoppingListItemDao = {
			id: uuidv4(),
			shoppingListId: item.shoppingListId,
			name: item.name,
			quantity: item.quantity ?? null,
			unit: item.unit ?? null,
			checked: item.checked ?? false,
			fromRecipeId: item.fromRecipeId ?? null,
			notes: item.notes ?? null,
			orderIndex: item.orderIndex ?? 0,
			createdAt: new Date(),
			forPlannedMealIds: item.forPlannedMealIds ?? [],
			mergeKey: item.mergeKey ?? normalizeItemKey(item.name),
			heldUntil: item.heldUntil ?? null,
			source: item.source ?? 'MANUAL'
		};
		this.items.set(created.id, created);
		return created;
	}

	async createMany(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]> {
		const created: ShoppingListItemDao[] = [];
		for (const item of items) {
			created.push(await this.create(item));
		}
		return created;
	}

	/** Like the unique need index: one plan or usual row per list, source, item, unit and hold. */
	async createNeeds(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]> {
		const key = (i: {
			shoppingListId: string;
			source?: string;
			mergeKey?: string | null;
			unit?: string | null;
			heldUntil?: Date | null;
		}) => [i.shoppingListId, i.source, i.mergeKey, i.unit ?? '', i.heldUntil != null].join('|');
		const created: ShoppingListItemDao[] = [];
		for (const item of items) {
			const taken = [...this.items.values()].some(
				(existing) =>
					(existing.source === 'PLAN' || existing.source === 'USUAL') && key(existing) === key(item)
			);
			if (!taken) created.push(await this.create(item));
		}
		return created;
	}

	async deleteMany(ids: string[]): Promise<void> {
		for (const id of ids) this.items.delete(id);
	}

	async update(id: string, item: UpdateShoppingListItemDao): Promise<ShoppingListItemDao> {
		const existing = this.items.get(id);
		if (!existing) throw new Error(`Item ${id} not found`);

		const updated: ShoppingListItemDao = {
			...existing,
			...item,
			id: existing.id,
			shoppingListId: existing.shoppingListId,
			createdAt: existing.createdAt
		};
		this.items.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.items.delete(id);
	}

	async getMaxOrderIndex(listId: string): Promise<number> {
		const items = await this.findByListId(listId);
		if (items.length === 0) return -1;
		return Math.max(...items.map((i) => i.orderIndex));
	}

	// Test helpers
	getStored(id: string): ShoppingListItemDao | undefined {
		return this.items.get(id);
	}

	getAllStored(): ShoppingListItemDao[] {
		return Array.from(this.items.values());
	}

	clear(): void {
		this.items.clear();
	}
}
