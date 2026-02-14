import type {
  ShoppingListDao,
  NewShoppingListDao,
  UpdateShoppingListDao,
  ShoppingListWithItemsDao,
  ShoppingListItemDao,
  NewShoppingListItemDao,
  UpdateShoppingListItemDao,
  AddItemInputDao,
} from "../daos";

export interface IShoppingListRepository {
  findById(id: string): Promise<ShoppingListDao | null>;
  findByIdWithItems(id: string): Promise<ShoppingListWithItemsDao | null>;
  findActiveByUserId(userId: string): Promise<ShoppingListWithItemsDao | null>;
  findByUserId(userId: string): Promise<ShoppingListWithItemsDao[]>;
  create(list: NewShoppingListDao): Promise<ShoppingListDao>;
  update(id: string, list: UpdateShoppingListDao): Promise<ShoppingListDao>;
  delete(id: string): Promise<void>;
  deactivateAllByUserId(userId: string): Promise<void>;
}

export interface IShoppingListItemRepository {
  findById(id: string): Promise<ShoppingListItemDao | null>;
  findByListId(listId: string): Promise<ShoppingListItemDao[]>;
  findCheckedByListId(listId: string): Promise<ShoppingListItemDao[]>;
  create(item: NewShoppingListItemDao): Promise<ShoppingListItemDao>;
  createMany(items: NewShoppingListItemDao[]): Promise<ShoppingListItemDao[]>;
  update(
    id: string,
    item: UpdateShoppingListItemDao,
  ): Promise<ShoppingListItemDao>;
  delete(id: string): Promise<void>;
  deleteCheckedByListId(listId: string): Promise<void>;
  getMaxOrderIndex(listId: string): Promise<number>;
  updateOrderIndex(id: string, orderIndex: number): Promise<void>;
}
