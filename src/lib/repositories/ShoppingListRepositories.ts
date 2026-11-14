import { eq, and, inArray, sql } from 'drizzle-orm';
import { normalizeItemKey } from '$lib/models/kitchen';
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
			items: list.items.map((item) => this.itemToDao(item))
		};
	}

	async findActiveByHouseholdId(householdId: string): Promise<ShoppingListWithItemsDao | null> {
		const list = await this.db.query.shoppingLists.findFirst({
			where: and(
				eq(schema.shoppingLists.householdId, householdId),
				eq(schema.shoppingLists.isActive, true)
			),
			with: { items: { orderBy: [schema.shoppingListItems.orderIndex] } }
		});

		if (!list) return null;

		return {
			...this.toDao(list),
			items: list.items.map((item) => this.itemToDao(item))
		};
	}

	async create(list: NewShoppingListDao): Promise<ShoppingListDao> {
		const [created] = await this.db
			.insert(schema.shoppingLists)
			.values({
				userId: list.userId,
				householdId: list.householdId,
				name: list.name,
				isActive: list.isActive ?? true
			})
			.returning();
		return this.toDao(created);
	}

	async update(id: string, list: UpdateShoppingListDao): Promise<ShoppingListDao> {
		const [updated] = await this.db
			.update(schema.shoppingLists)
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

	private toDao(list: typeof schema.shoppingLists.$inferSelect): ShoppingListDao {
		return {
			id: list.id,
			userId: list.userId,
			householdId: list.householdId,
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
			createdAt: item.createdAt,
			forPlannedMealIds: item.forPlannedMealIds,
			mergeKey: item.mergeKey,
			heldUntil: item.heldUntil,
			source: item.source
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
		return items.map((i) => this.toDao(i));
	}

	async create(item: NewShoppingListItemDao): Promise<ShoppingListItemDao> {
		const [created] = await this.db
			.insert(schema.shoppingListItems)
			.values({
				shoppingListId: item.shoppingListId,
				name: item.name,
				quantity: item.quantity ?? null,
				unit: item.unit ?? null,
				checked: item.checked ?? false,
				fromRecipeId: item.fromRecipeId ?? null,
				notes: item.notes ?? null,
				orderIndex: item.orderIndex ?? 0,
				forPlannedMealIds: item.forPlannedMealIds ?? [],
				mergeKey: item.mergeKey ?? normalizeItemKey(item.name),
				heldUntil: item.heldUntil ?? null,
				source: item.source ?? 'MANUAL'
			})
			.returning();
		return this.toDao(created);
	}

	async createMany(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]> {
		if (items.length === 0) return [];
		const created = await this.db
			.insert(schema.shoppingListItems)
			.values(items.map((item) => this.toRow(item)))
			.returning();
		return created.map((i) => this.toDao(i));
	}

	async createNeeds(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]> {
		if (items.length === 0) return [];
		// The unique need index turns a row another request already added into a no-op.
		const created = await this.db
			.insert(schema.shoppingListItems)
			.values(items.map((item) => this.toRow(item)))
			.onConflictDoNothing()
			.returning();
		return created.map((i) => this.toDao(i));
	}

	async deleteMany(ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.db.delete(schema.shoppingListItems).where(inArray(schema.shoppingListItems.id, ids));
	}

	private toRow(item: NewShoppingListItemDao): typeof schema.shoppingListItems.$inferInsert {
		return {
			...item,
			mergeKey: item.mergeKey ?? normalizeItemKey(item.name),
			forPlannedMealIds: item.forPlannedMealIds ?? []
		};
	}

	async update(id: string, item: UpdateShoppingListItemDao): Promise<ShoppingListItemDao> {
		const [updated] = await this.db
			.update(schema.shoppingListItems)
			.set(item)
			.where(eq(schema.shoppingListItems.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.shoppingListItems).where(eq(schema.shoppingListItems.id, id));
	}

	async getMaxOrderIndex(listId: string): Promise<number> {
		const result = await this.db
			.select({
				maxOrder: sql<number>`COALESCE(MAX(${schema.shoppingListItems.orderIndex}), -1)`.as(
					'maxOrder'
				)
			})
			.from(schema.shoppingListItems)
			.where(eq(schema.shoppingListItems.shoppingListId, listId));

		return result[0]?.maxOrder ?? -1;
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
			createdAt: item.createdAt,
			forPlannedMealIds: item.forPlannedMealIds,
			mergeKey: item.mergeKey,
			heldUntil: item.heldUntil,
			source: item.source
		};
	}
}
