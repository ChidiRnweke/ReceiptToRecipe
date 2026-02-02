export interface ShoppingListDao {
	id: string;
	userId: string;
	name: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewShoppingListDao {
	userId: string;
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
}

export interface UpdateShoppingListItemDao {
	name?: string;
	quantity?: string | null;
	unit?: string | null;
	checked?: boolean;
	notes?: string | null;
	orderIndex?: number;
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
