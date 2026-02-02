import type { ILlmService } from './ILlmService';

export interface AddItemInput {
	name: string;
	quantity?: string;
	unit?: string;
	fromRecipeId?: string;
	notes?: string;
}

export interface SmartSuggestion {
	itemName: string;
	lastPurchased: Date;
	avgFrequencyDays: number | null;
	daysSinceLastPurchase: number;
	suggestedQuantity: string | null;
}

export interface ShoppingListWithItems {
	id: string;
	userId: string;
	name: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	items: ShoppingListItem[];
}

export interface ShoppingListItem {
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

export interface IShoppingListService {
	getActiveList(userId: string): Promise<ShoppingListWithItems>;
	getUserLists(userId: string): Promise<ShoppingListWithItems[]>;
	createList(userId: string, name: string): Promise<{ id: string; userId: string; name: string; isActive: boolean; createdAt: Date; updatedAt: Date }>;
	addItem(listId: string, input: AddItemInput): Promise<ShoppingListItem>;
	addRecipeIngredients(listId: string, recipeId: string, excludeInStock?: boolean, pantryItems?: string[]): Promise<ShoppingListItem[]>;
	addReceiptItems(listId: string, receiptId: string): Promise<ShoppingListItem[]>;
	toggleItem(itemId: string, checked?: boolean): Promise<ShoppingListItem>;
	removeItem(itemId: string): Promise<void>;
	completeShopping(listId: string): Promise<void>;
	getSmartSuggestions(userId: string, limit?: number): Promise<SmartSuggestion[]>;
	addSuggestion(listId: string, suggestion: SmartSuggestion): Promise<ShoppingListItem>;
	createRestockList(userId: string, llmService: ILlmService): Promise<ShoppingListWithItems>;
	reorderItems(listId: string, itemIds: string[]): Promise<void>;
	deleteList(listId: string, userId: string): Promise<void>;
	generateFromRecipes(userId: string, recipeIds: string[], name: string): Promise<ShoppingListWithItems>;
}
