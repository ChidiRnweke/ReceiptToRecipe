import { db } from '$db/client';
import {
	shoppingLists,
	shoppingListItems,
	purchaseHistory,
	recipeIngredients,
	receiptItems
} from '$db/schema';
import type {
	ShoppingList,
	ShoppingListItem,
	NewShoppingListItem
} from '$db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { ILlmService } from '$lib/services';

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
	async getUserLists(userId: string): Promise<ShoppingListWithItems[]> {
		return db.query.shoppingLists.findMany({
			where: eq(shoppingLists.userId, userId),
			orderBy: [desc(shoppingLists.createdAt)],
			with: {
				items: {
					orderBy: [shoppingListItems.orderIndex]
				}
			}
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
	 * Add all receipt items to a shopping list
	 */
	async addReceiptItems(listId: string, receiptId: string): Promise<ShoppingListItem[]> {
		const items = await db.query.receiptItems.findMany({
			where: eq(receiptItems.receiptId, receiptId)
		});

		const results: ShoppingListItem[] = [];
		for (const item of items) {
			const created = await this.addItem(listId, {
				name: item.normalizedName,
				quantity: item.quantity,
				unit: item.unit
			});
			results.push(created);
		}
		return results;
	}

	/**
	 * Toggle item checked status
	 */
	async toggleItem(itemId: string, checked?: boolean): Promise<ShoppingListItem> {
		const item = await db.query.shoppingListItems.findFirst({
			where: eq(shoppingListItems.id, itemId)
		});

		if (!item) {
			throw new Error('Item not found');
		}

		const nextValue = typeof checked === 'boolean' ? checked : !item.checked;

		const [updated] = await db
			.update(shoppingListItems)
			.set({ checked: nextValue })
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
	 * Build a restock shopping list using history and LLM reasoning
	 */
	async createRestockList(userId: string, llmService: ILlmService): Promise<ShoppingListWithItems> {
		const history = await db.query.purchaseHistory.findMany({
			where: eq(purchaseHistory.userId, userId),
			orderBy: [desc(purchaseHistory.lastPurchased)]
		});

		if (history.length === 0) {
			throw new Error('No purchase history yet');
		}

		const name = `Restock · ${new Date().toLocaleDateString()}`;
		const list = await this.createList(userId, name);

		const prompt = `You are planning a grocery restock.
Given purchase history entries with last purchase date, average frequency days, and average quantity, decide which items likely need replenishing today.
Output ONLY JSON array: [{ "itemName": string, "restock": boolean, "quantity": string, "note": string }]
Restock only items that are probably running low. Today is ${new Date().toISOString()}.

History:
${history
	.map(
		(h) =>
			`- ${h.itemName}: lastPurchased=${h.lastPurchased.toISOString()}, avgFrequencyDays=${h.avgFrequencyDays ?? 'unknown'}, avgQuantity=${h.avgQuantity ?? 'unknown'}`
	)
	.join('\n')}`;

		let decisions: Array<{ itemName: string; restock: boolean; quantity?: string; note?: string }> = [];

		try {
			const response = await llmService.chat(
				[
					{ role: 'system', content: 'Return only valid JSON. No explanations.' },
					{ role: 'user', content: prompt }
				],
				'You are a precise planner. Respond with compact JSON only.'
			);
			const parsed = JSON.parse(response);
			if (Array.isArray(parsed)) {
				decisions = parsed;
			}
		} catch (err) {
			console.warn('LLM restock planning failed, falling back to heuristics', err);
		}

		if (!decisions.length) {
			const suggestions = await this.getSmartSuggestions(userId, 15);
			decisions = suggestions.map((s) => ({
				itemName: s.itemName,
				restock: true,
				quantity: s.suggestedQuantity ?? '1',
				note: 'Based on your usual refill pattern'
			}));
		}

		let orderIndex = 0;
		for (const decision of decisions) {
			if (!decision.restock) continue;
			await db.insert(shoppingListItems).values({
				shoppingListId: list.id,
				name: decision.itemName,
				quantity: decision.quantity ?? undefined,
				unit: undefined,
				notes: decision.note,
				orderIndex: orderIndex++
			});
		}

		const items = await db.query.shoppingListItems.findMany({
			where: eq(shoppingListItems.shoppingListId, list.id),
			orderBy: [shoppingListItems.orderIndex]
		});

		return { ...list, items };
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

	/**
	 * Create a shopping list from one or more recipes
	 */
	async generateFromRecipes(userId: string, recipeIds: string[], name: string): Promise<ShoppingListWithItems> {
		const list = await this.createList(userId, name);

		for (const recipeId of recipeIds) {
			await this.addRecipeIngredients(list.id, recipeId);
		}

		const items = await db.query.shoppingListItems.findMany({
			where: eq(shoppingListItems.shoppingListId, list.id),
			orderBy: [shoppingListItems.orderIndex]
		});

		return { ...list, items };
	}
}
