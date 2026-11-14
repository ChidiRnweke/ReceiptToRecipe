import type { ShoppingItemSource } from '$lib/models/shop';

export interface ShoppingListDao {
	id: string;
	userId: string;
	householdId: string;
	name: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewShoppingListDao {
	userId: string;
	householdId: string;
	name: string;
	isActive?: boolean;
}

export interface UpdateShoppingListDao {
	name?: string;
	isActive?: boolean;
}

export interface ShoppingListItemDao {
	id: string;
	shoppingListId: string;
	name: string;
	quantity: string | null;
	unit: string | null;
	checked: boolean;
	fromRecipeId: string | null;
	notes: string | null;
	orderIndex: number;
	createdAt: Date;
	/** Planned meals the item is bought for; the first is the dish it is listed under. */
	forPlannedMealIds: string[];
	/** Item key of the name, so the same item from several dishes merges. */
	mergeKey: string | null;
	/** Held back for a later shop. */
	heldUntil: Date | null;
	source: ShoppingItemSource;
}

export interface NewShoppingListItemDao {
	shoppingListId: string;
	name: string;
	quantity?: string | null;
	unit?: string | null;
	checked?: boolean;
	fromRecipeId?: string | null;
	notes?: string | null;
	orderIndex?: number;
	forPlannedMealIds?: string[];
	mergeKey?: string | null;
	heldUntil?: Date | null;
	source?: ShoppingItemSource;
}

export interface UpdateShoppingListItemDao {
	name?: string;
	quantity?: string | null;
	unit?: string | null;
	checked?: boolean;
	notes?: string | null;
	orderIndex?: number;
	forPlannedMealIds?: string[];
	heldUntil?: Date | null;
}

export interface ShoppingListWithItemsDao extends ShoppingListDao {
	items: ShoppingListItemDao[];
}

export interface AddItemInputDao {
	name: string;
	quantity?: string;
	unit?: string;
	fromRecipeId?: string;
	notes?: string;
}
