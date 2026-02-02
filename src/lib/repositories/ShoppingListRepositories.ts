import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IShoppingListRepository, IShoppingListItemRepository } from './interfaces';
import type { 
	ShoppingListDao, 
	NewShoppingListDao, 
	UpdateShoppingListDao,
	ShoppingListWithItemsDao,
	ShoppingListItemDao,
	NewShoppingListItemDao,
	UpdateShoppingListItemDao
} from './daos';

export class ShoppingListRepository implements IShoppingListRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<ShoppingListDao | null> {
		const list = await this.db.query.shoppingLists.findFirst({
			where: eq(schema.shoppingLists.id, id)
		});
		return list ? this.toDao(list) : null;
	}

	async findByIdWithItems(id: string): Promise<ShoppingListWithItemsDao | null> {
		const list = await this.db.query.shoppingLists.findFirst({
			where: eq(schema.shoppingLists.id, id),
			with: { items: { orderBy: [schema.shoppingListItems.orderIndex] } }
		});

		if (!list) return null;

		return {
			...this.toDao(list),
			items: list.items.map(item => this.itemToDao(item))
		};
	}

	async findActiveByUserId(userId: string): Promise<ShoppingListWithItemsDao | null> {
		const list = await this.db.query.shoppingLists.findFirst({
			where: and(
				eq(schema.shoppingLists.userId, userId),
				eq(schema.shoppingLists.isActive, true)
			),
			with: { items: { orderBy: [schema.shoppingListItems.orderIndex] } }
		});

		if (!list) return null;

		return {
			...this.toDao(list),
			items: list.items.map(item => this.itemToDao(item))
		};
	}

	async findByUserId(userId: string): Promise<ShoppingListWithItemsDao[]> {
		const lists = await this.db.query.shoppingLists.findMany({
			where: eq(schema.shoppingLists.userId, userId),
			orderBy: [desc(schema.shoppingLists.createdAt)],
			with: { items: { orderBy: [schema.shoppingListItems.orderIndex] } }
		});

		return lists.map(list => ({
			...this.toDao(list),
			items: list.items.map(item => this.itemToDao(item))
		}));
	}

	async create(list: NewShoppingListDao): Promise<ShoppingListDao> {
		const [created] = await this.db.insert(schema.shoppingLists).values({
			userId: list.userId,
			name: list.name,
			isActive: list.isActive ?? true
		}).returning();
		return this.toDao(created);
	}

	async update(id: string, list: UpdateShoppingListDao): Promise<ShoppingListDao> {
		const [updated] = await this.db.update(schema.shoppingLists)
			.set({
				...list,
				updatedAt: new Date()
			})
			.where(eq(schema.shoppingLists.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.shoppingLists).where(eq(schema.shoppingLists.id, id));
	}

	async deactivateAllByUserId(userId: string): Promise<void> {
		await this.db.update(schema.shoppingLists)
			.set({ isActive: false })
			.where(eq(schema.shoppingLists.userId, userId));
	}

	private toDao(list: typeof schema.shoppingLists.$inferSelect): ShoppingListDao {
		return {
			id: list.id,
			userId: list.userId,
			name: list.name,
			isActive: list.isActive ?? true,
			createdAt: list.createdAt,
			updatedAt: list.updatedAt
		};
	}

	private itemToDao(item: typeof schema.shoppingListItems.$inferSelect): ShoppingListItemDao {
		return {
			id: item.id,
			shoppingListId: item.shoppingListId,
			name: item.name,
			quantity: item.quantity,
			unit: item.unit,
			checked: item.checked ?? false,
			fromRecipeId: item.fromRecipeId,
			notes: item.notes,
			orderIndex: item.orderIndex,
			createdAt: item.createdAt
		};
	}
}

export class ShoppingListItemRepository implements IShoppingListItemRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<ShoppingListItemDao | null> {
		const item = await this.db.query.shoppingListItems.findFirst({
			where: eq(schema.shoppingListItems.id, id)
		});
		return item ? this.toDao(item) : null;
	}

	async findByListId(listId: string): Promise<ShoppingListItemDao[]> {
		const items = await this.db.query.shoppingListItems.findMany({
			where: eq(schema.shoppingListItems.shoppingListId, listId),
			orderBy: [schema.shoppingListItems.orderIndex]
		});
		return items.map(i => this.toDao(i));
	}

	async findCheckedByListId(listId: string): Promise<ShoppingListItemDao[]> {
		const items = await this.db.query.shoppingListItems.findMany({
			where: and(
				eq(schema.shoppingListItems.shoppingListId, listId),
				eq(schema.shoppingListItems.checked, true)
			)
		});
		return items.map(i => this.toDao(i));
	}

	async create(item: NewShoppingListItemDao): Promise<ShoppingListItemDao> {
		const [created] = await this.db.insert(schema.shoppingListItems).values({
			shoppingListId: item.shoppingListId,
			name: item.name,
			quantity: item.quantity ?? null,
			unit: item.unit ?? null,
			checked: item.checked ?? false,
			fromRecipeId: item.fromRecipeId ?? null,
			notes: item.notes ?? null,
			orderIndex: item.orderIndex ?? 0
		}).returning();
		return this.toDao(created);
	}

	async createMany(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]> {
		if (items.length === 0) return [];
		const created = await this.db.insert(schema.shoppingListItems).values(items).returning();
		return created.map(i => this.toDao(i));
	}

	async update(id: string, item: UpdateShoppingListItemDao): Promise<ShoppingListItemDao> {
		const [updated] = await this.db.update(schema.shoppingListItems)
			.set(item)
			.where(eq(schema.shoppingListItems.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.shoppingListItems).where(eq(schema.shoppingListItems.id, id));
	}

	async deleteCheckedByListId(listId: string): Promise<void> {
		await this.db.delete(schema.shoppingListItems)
			.where(and(
				eq(schema.shoppingListItems.shoppingListId, listId),
				eq(schema.shoppingListItems.checked, true)
			));
	}

	async getMaxOrderIndex(listId: string): Promise<number> {
		const result = await this.db
			.select({ maxOrder: sql<number>`COALESCE(MAX(${schema.shoppingListItems.orderIndex}), -1)`.as('maxOrder') })
			.from(schema.shoppingListItems)
			.where(eq(schema.shoppingListItems.shoppingListId, listId));

		return result[0]?.maxOrder ?? -1;
	}

	async updateOrderIndex(id: string, orderIndex: number): Promise<void> {
		await this.db.update(schema.shoppingListItems)
			.set({ orderIndex })
			.where(eq(schema.shoppingListItems.id, id));
	}

	private toDao(item: typeof schema.shoppingListItems.$inferSelect): ShoppingListItemDao {
		return {
			id: item.id,
			shoppingListId: item.shoppingListId,
			name: item.name,
			quantity: item.quantity,
			unit: item.unit,
			checked: item.checked ?? false,
			fromRecipeId: item.fromRecipeId,
			notes: item.notes,
			orderIndex: item.orderIndex,
			createdAt: item.createdAt
		};
	}
}
