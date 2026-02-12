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

	async findActiveByUserId(userId: string): Promise<ShoppingListWithItemsDao | null> {
		const list = Array.from(this.lists.values()).find(l => l.userId === userId && l.isActive);
		if (!list) return null;
		return this.findByIdWithItems(list.id);
	}

	async findByUserId(userId: string): Promise<ShoppingListWithItemsDao[]> {
		const lists = Array.from(this.lists.values())
			.filter(l => l.userId === userId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		
		return Promise.all(lists.map(l => this.findByIdWithItems(l.id)))
			.then(results => results.filter((l): l is ShoppingListWithItemsDao => !!l));
	}

	async create(list: NewShoppingListDao): Promise<ShoppingListDao> {
		const now = new Date();
		const created: ShoppingListDao = {
			id: uuidv4(),
			userId: list.userId,
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
			createdAt: existing.createdAt,
			updatedAt: new Date()
		};
		this.lists.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.lists.delete(id);
	}

	async deactivateAllByUserId(userId: string): Promise<void> {
		for (const [id, list] of this.lists) {
			if (list.userId === userId && list.isActive) {
				list.isActive = false;
				list.updatedAt = new Date();
			}
		}
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
			.filter(i => i.shoppingListId === listId)
			.sort((a, b) => a.orderIndex - b.orderIndex);
	}

	async findCheckedByListId(listId: string): Promise<ShoppingListItemDao[]> {
		return (await this.findByListId(listId)).filter(i => i.checked);
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
			createdAt: new Date()
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

	async deleteCheckedByListId(listId: string): Promise<void> {
		for (const [id, item] of this.items) {
			if (item.shoppingListId === listId && item.checked) {
				this.items.delete(id);
			}
		}
	}

	async getMaxOrderIndex(listId: string): Promise<number> {
		const items = await this.findByListId(listId);
		if (items.length === 0) return -1;
		return Math.max(...items.map(i => i.orderIndex));
	}

	async updateOrderIndex(id: string, orderIndex: number): Promise<void> {
		const item = this.items.get(id);
		if (item) {
			item.orderIndex = orderIndex;
		}
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
