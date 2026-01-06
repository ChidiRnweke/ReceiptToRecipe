import { db } from '$db/client';
import {
	shoppingLists,
	shoppingListItems,
	purchaseHistory,
	recipeIngredients
} from '$db/schema';
import type {
	ShoppingList,
	ShoppingListItem,
	NewShoppingList,
	NewShoppingListItem
} from '$db/schema';
import { eq, desc, and, lt, sql } from 'drizzle-orm';

export interface ShoppingListWithItems extends ShoppingList {
	items: ShoppingListItem[];
}

export interface SmartSuggestion {
	itemName: string;
	lastPurchased: Date;
	avgFrequencyDays: number | null;
	daysSinceLastPurchase: number;
	suggestedQuantity: string | null;
}

export interface AddItemInput {
	name: string;
	quantity?: string;
	unit?: string;
	fromRecipeId?: string;
	notes?: string;
}

export class ShoppingListController {
	/**
	 * Get or create the active shopping list for a user
	 */
	async getActiveList(userId: string): Promise<ShoppingListWithItems> {
		let list = await db.query.shoppingLists.findFirst({
			where: and(eq(shoppingLists.userId, userId), eq(shoppingLists.isActive, true)),
			with: {
				items: {
					orderBy: [shoppingListItems.orderIndex]
				}
			}
		});

		if (!list) {
			const [newList] = await db
				.insert(shoppingLists)
				.values({
					userId,
					name: 'Shopping List',
					isActive: true
				})
				.returning();

			list = { ...newList, items: [] };
		}

		return list;
	}

	/**
	 * Get all shopping lists for a user
	 */
	async getUserLists(userId: string): Promise<ShoppingList[]> {
		return db.query.shoppingLists.findMany({
			where: eq(shoppingLists.userId, userId),
			orderBy: [desc(shoppingLists.createdAt)]
		});
	}

	/**
	 * Create a new shopping list
	 */
	async createList(userId: string, name: string): Promise<ShoppingList> {
		// Deactivate existing lists
		await db
			.update(shoppingLists)
			.set({ isActive: false })
			.where(eq(shoppingLists.userId, userId));

		const [list] = await db
			.insert(shoppingLists)
			.values({
				userId,
				name,
				isActive: true
			})
			.returning();

		return list;
	}

	/**
	 * Add an item to the shopping list
	 */
	async addItem(listId: string, input: AddItemInput): Promise<ShoppingListItem> {
		// Get current max order index
		const maxOrderResult = await db
			.select({ maxOrder: sql<number>`COALESCE(MAX(${shoppingListItems.orderIndex}), -1)` })
			.from(shoppingListItems)
			.where(eq(shoppingListItems.shoppingListId, listId));

		const nextOrder = (maxOrderResult[0]?.maxOrder || -1) + 1;

		const [item] = await db
			.insert(shoppingListItems)
			.values({
				shoppingListId: listId,
				name: input.name,
				quantity: input.quantity,
				unit: input.unit,
				fromRecipeId: input.fromRecipeId,
				notes: input.notes,
				orderIndex: nextOrder
			})
			.returning();

		return item;
	}

	/**
	 * Add ingredients from a recipe to the shopping list
	 */
	async addRecipeIngredients(listId: string, recipeId: string): Promise<ShoppingListItem[]> {
		const ingredients = await db.query.recipeIngredients.findMany({
			where: eq(recipeIngredients.recipeId, recipeId)
		});

		const items: ShoppingListItem[] = [];

		for (const ing of ingredients) {
			const item = await this.addItem(listId, {
				name: ing.name,
				quantity: ing.quantity,
				unit: ing.unit,
				fromRecipeId: recipeId
			});
			items.push(item);
		}

		return items;
	}

	/**
	 * Toggle item checked status
	 */
	async toggleItemChecked(itemId: string): Promise<ShoppingListItem> {
		const item = await db.query.shoppingListItems.findFirst({
			where: eq(shoppingListItems.id, itemId)
		});

		if (!item) {
			throw new Error('Item not found');
		}

		const [updated] = await db
			.update(shoppingListItems)
			.set({ checked: !item.checked })
			.where(eq(shoppingListItems.id, itemId))
			.returning();

		return updated;
	}

	/**
	 * Remove an item from the shopping list
	 */
	async removeItem(itemId: string): Promise<void> {
		await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
	}

	/**
	 * Clear all checked items from a list
	 */
	async clearCheckedItems(listId: string): Promise<void> {
		await db
			.delete(shoppingListItems)
			.where(
				and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.checked, true))
			);
	}

	/**
	 * Get smart suggestions based on purchase history
	 */
	async getSmartSuggestions(userId: string, limit: number = 10): Promise<SmartSuggestion[]> {
		const now = new Date();

		// Find items that might be running low based on purchase frequency
		const history = await db.query.purchaseHistory.findMany({
			where: eq(purchaseHistory.userId, userId),
			orderBy: [desc(purchaseHistory.lastPurchased)]
		});

		const suggestions: SmartSuggestion[] = [];

		for (const item of history) {
			const daysSinceLastPurchase = Math.floor(
				(now.getTime() - item.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
			);

			// Suggest if days since last purchase >= 80% of average frequency
			if (
				item.avgFrequencyDays &&
				daysSinceLastPurchase >= item.avgFrequencyDays * 0.8
			) {
				suggestions.push({
					itemName: item.itemName,
					lastPurchased: item.lastPurchased,
					avgFrequencyDays: item.avgFrequencyDays,
					daysSinceLastPurchase,
					suggestedQuantity: item.avgQuantity
				});
			}
		}

		// Sort by how "overdue" the item is
		return suggestions
			.sort((a, b) => {
				const aOverdue = a.avgFrequencyDays
					? a.daysSinceLastPurchase / a.avgFrequencyDays
					: 0;
				const bOverdue = b.avgFrequencyDays
					? b.daysSinceLastPurchase / b.avgFrequencyDays
					: 0;
				return bOverdue - aOverdue;
			})
			.slice(0, limit);
	}

	/**
	 * Add a suggested item to the shopping list
	 */
	async addSuggestion(listId: string, suggestion: SmartSuggestion): Promise<ShoppingListItem> {
		return this.addItem(listId, {
			name: suggestion.itemName,
			quantity: suggestion.suggestedQuantity || undefined,
			notes: `Suggested based on ~${suggestion.avgFrequencyDays} day purchase cycle`
		});
	}

	/**
	 * Reorder items in a list
	 */
	async reorderItems(listId: string, itemIds: string[]): Promise<void> {
		for (let i = 0; i < itemIds.length; i++) {
			await db
				.update(shoppingListItems)
				.set({ orderIndex: i })
				.where(
					and(
						eq(shoppingListItems.id, itemIds[i]),
						eq(shoppingListItems.shoppingListId, listId)
					)
				);
		}
	}

	/**
	 * Delete a shopping list
	 */
	async deleteList(listId: string, userId: string): Promise<void> {
		const list = await db.query.shoppingLists.findFirst({
			where: and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId))
		});

		if (!list) {
			throw new Error('Shopping list not found');
		}

		await db.delete(shoppingLists).where(eq(shoppingLists.id, listId));
	}
}
