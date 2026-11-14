import type {
	ShoppingListDao,
	NewShoppingListDao,
	UpdateShoppingListDao,
	ShoppingListWithItemsDao,
	ShoppingListItemDao,
	NewShoppingListItemDao,
	UpdateShoppingListItemDao
} from '../daos';

export interface IShoppingListRepository {
	findById(id: string): Promise<ShoppingListDao | null>;
	findByIdWithItems(id: string): Promise<ShoppingListWithItemsDao | null>;
	findActiveByHouseholdId(householdId: string): Promise<ShoppingListWithItemsDao | null>;
	create(list: NewShoppingListDao): Promise<ShoppingListDao>;
	update(id: string, list: UpdateShoppingListDao): Promise<ShoppingListDao>;
	delete(id: string): Promise<void>;
}

export interface IShoppingListItemRepository {
	findById(id: string): Promise<ShoppingListItemDao | null>;
	findByListId(listId: string): Promise<ShoppingListItemDao[]>;
	create(item: NewShoppingListItemDao): Promise<ShoppingListItemDao>;
	createMany(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]>;
	/** Adds plan and usual rows; a row the unique need index already holds is skipped. */
	createNeeds(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]>;
	deleteMany(ids: string[]): Promise<void>;
	update(id: string, item: UpdateShoppingListItemDao): Promise<ShoppingListItemDao>;
	delete(id: string): Promise<void>;
	getMaxOrderIndex(listId: string): Promise<number>;
}
