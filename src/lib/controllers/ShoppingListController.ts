import type { IShoppingListRepository, IShoppingListItemRepository } from '$repositories';
import type { IPurchaseHistoryRepository } from '$repositories';
import type { IRecipeIngredientRepository } from '$repositories';
import type { IReceiptItemRepository } from '$repositories';
import type { ICulinaryIntelligence } from '$lib/services';
import type {
	ShoppingListDao,
	ShoppingListItemDao,
	ShoppingListWithItemsDao
} from '$lib/repositories/daos';

export type { ShoppingListWithItemsDao as ShoppingListWithItems };

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
	constructor(
		private shoppingListRepo: IShoppingListRepository,
		private shoppingListItemRepo: IShoppingListItemRepository,
		private purchaseHistoryRepo: IPurchaseHistoryRepository,
		private recipeIngredientRepo: IRecipeIngredientRepository,
		private receiptItemRepo: IReceiptItemRepository
	) {}

	/**
	 * Helper to verify list ownership
	 */
	private async verifyListOwnership(userId: string, listId: string): Promise<void> {
		const list = await this.shoppingListRepo.findById(listId);
		if (!list) throw new Error('List not found');
		if (list.userId !== userId) {
			throw new Error('Unauthorized access to shopping list');
		}
	}

	/**
	 * Helper to verify item ownership (via list)
	 */
	private async verifyItemOwnership(userId: string, itemId: string): Promise<void> {
		const item = await this.shoppingListItemRepo.findById(itemId);
		if (!item) throw new Error('Item not found');
		await this.verifyListOwnership(userId, item.shoppingListId);
	}

	/**
	 * Get or create the active shopping list for a user
	 */
	async getActiveList(userId: string): Promise<ShoppingListWithItemsDao> {
		const existing = await this.shoppingListRepo.findActiveByUserId(userId);
		if (existing) return existing;

		const newList = await this.shoppingListRepo.create({
			userId,
			name: 'Shopping List',
			isActive: true
		});

		return { ...newList, items: [] };
	}

	/**
	 * Get all shopping lists for a user
	 */
	async getUserLists(userId: string): Promise<ShoppingListWithItemsDao[]> {
		return this.shoppingListRepo.findByUserId(userId);
	}

	/**
	 * Create a new shopping list
	 */
	async createList(userId: string, name: string): Promise<ShoppingListDao> {
		// Deactivate existing lists
		await this.shoppingListRepo.deactivateAllByUserId(userId);

		return this.shoppingListRepo.create({
			userId,
			name,
			isActive: true
		});
	}

	/**
	 * Add an item to the shopping list
	 */
	async addItem(userId: string, listId: string, input: AddItemInput): Promise<ShoppingListItemDao> {
		await this.verifyListOwnership(userId, listId);

		const maxOrder = await this.shoppingListItemRepo.getMaxOrderIndex(listId);
		const nextOrder = maxOrder + 1;

		return this.shoppingListItemRepo.create({
			shoppingListId: listId,
			name: input.name,
			quantity: input.quantity,
			unit: input.unit,
			fromRecipeId: input.fromRecipeId,
			notes: input.notes,
			orderIndex: nextOrder
		});
	}

	/**
	 * Add ingredients from a recipe to the shopping list
	 * Optionally exclude items that are likely in stock
	 */
	async addRecipeIngredients(
		userId: string,
		listId: string,
		recipeId: string,
		excludeInStock: boolean = false,
		pantryItems: string[] = []
	): Promise<ShoppingListItemDao[]> {
		await this.verifyListOwnership(userId, listId);

		const ingredients = await this.recipeIngredientRepo.findByRecipeId(recipeId);

		const items: ShoppingListItemDao[] = [];
		const pantrySet = new Set(pantryItems.map((p) => p.toLowerCase()));

		for (const ing of ingredients) {
			if (excludeInStock) {
				const ingName = ing.name.toLowerCase();
				const inStock = Array.from(pantrySet).some(
					(p) => p.includes(ingName) || ingName.includes(p)
				);
				if (inStock) continue;
			}

			const item = await this.addItem(userId, listId, {
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
	async addReceiptItems(
		userId: string,
		listId: string,
		receiptId: string
	): Promise<ShoppingListItemDao[]> {
		await this.verifyListOwnership(userId, listId);

		const items = await this.receiptItemRepo.findByReceiptId(receiptId);

		const results: ShoppingListItemDao[] = [];
		for (const item of items) {
			const created = await this.addItem(userId, listId, {
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
	async toggleItem(
		userId: string,
		itemId: string,
		checked?: boolean
	): Promise<ShoppingListItemDao> {
		await this.verifyItemOwnership(userId, itemId);

		const item = await this.shoppingListItemRepo.findById(itemId);

		if (!item) {
			throw new Error('Item not found');
		}

		const nextValue = typeof checked === 'boolean' ? checked : !item.checked;

		return this.shoppingListItemRepo.update(itemId, { checked: nextValue });
	}

	/**
	 * Remove an item from the shopping list
	 */
	async removeItem(userId: string, itemId: string): Promise<void> {
		await this.verifyItemOwnership(userId, itemId);
		await this.shoppingListItemRepo.delete(itemId);
	}

	/**
	 * Clear all checked items from a list
	 */
	async clearCheckedItems(userId: string, listId: string): Promise<void> {
		await this.verifyListOwnership(userId, listId);
		await this.shoppingListItemRepo.deleteCheckedByListId(listId);
	}

	/**
	 * Complete shopping: move checked items to purchase history and clear them
	 */
	async completeShopping(userId: string, listId: string): Promise<void> {
		await this.verifyListOwnership(userId, listId);

		const checkedItems = await this.shoppingListItemRepo.findCheckedByListId(listId);

		if (checkedItems.length === 0) return;

		const now = new Date();

		// Update purchase history
		for (const item of checkedItems) {
			const existing = await this.purchaseHistoryRepo.findByUserAndItem(userId, item.name);

			if (existing) {
				const daysSinceLastPurchase = Math.floor(
					(now.getTime() - existing.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
				);
				const newFrequency = existing.avgFrequencyDays
					? Math.round((existing.avgFrequencyDays + daysSinceLastPurchase) / 2)
					: daysSinceLastPurchase > 0
						? daysSinceLastPurchase
						: existing.avgFrequencyDays;

				await this.purchaseHistoryRepo.update(existing.id, {
					lastPurchased: now,
					purchaseCount: existing.purchaseCount + 1,
					avgFrequencyDays: newFrequency
				});
			} else {
				await this.purchaseHistoryRepo.create({
					userId,
					itemName: item.name,
					lastPurchased: now,
					purchaseCount: 1,
					avgQuantity: item.quantity || undefined,
					avgFrequencyDays: null
				});
			}
		}

		// Clear checked items
		await this.clearCheckedItems(userId, listId);
	}

	/**
	 * Get smart suggestions based on purchase history
	 */
	async getSmartSuggestions(userId: string, limit: number = 10): Promise<SmartSuggestion[]> {
		const suggestions = await this.purchaseHistoryRepo.findSuggestions(userId, limit);
		return suggestions;
	}

	/**
	 * Add a suggested item to the shopping list
	 */
	async addSuggestion(
		userId: string,
		listId: string,
		suggestion: SmartSuggestion
	): Promise<ShoppingListItemDao> {
		return this.addItem(userId, listId, {
			name: suggestion.itemName,
			quantity: suggestion.suggestedQuantity || undefined,
			notes: `Suggested based on ~${suggestion.avgFrequencyDays} day purchase cycle`
		});
	}

	/**
	 * Build a restock shopping list using history and culinary intelligence reasoning
	 */
	async createRestockList(
		userId: string,
		culinaryIntelligence: ICulinaryIntelligence
	): Promise<ShoppingListWithItemsDao> {
		const history = await this.purchaseHistoryRepo.findByUserId(userId);

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

		let decisions: Array<{
			itemName: string;
			restock: boolean;
			quantity?: string;
			note?: string;
		}> = [];

		try {
			const response = await culinaryIntelligence.chat(
				[
					{
						role: 'system',
						content: 'Return only valid JSON. No explanations.'
					},
					{ role: 'user', content: prompt }
				],
				'You are a precise planner. Respond with compact JSON only.'
			);
			const parsed = JSON.parse(response);
			if (Array.isArray(parsed)) {
				decisions = parsed;
			}
		} catch (err) {
			console.warn(
				'Culinary intelligence restock planning failed, falling back to heuristics',
				err
			);
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
			await this.shoppingListItemRepo.create({
				shoppingListId: list.id,
				name: decision.itemName,
				quantity: decision.quantity ?? undefined,
				unit: undefined,
				notes: decision.note,
				orderIndex: orderIndex++
			});
		}

		const items = await this.shoppingListItemRepo.findByListId(list.id);

		return { ...list, items };
	}

	/**
	 * Reorder items in a list
	 */
	async reorderItems(userId: string, listId: string, itemIds: string[]): Promise<void> {
		await this.verifyListOwnership(userId, listId);
		for (let i = 0; i < itemIds.length; i++) {
			await this.shoppingListItemRepo.updateOrderIndex(itemIds[i], i);
		}
	}

	/**
	 * Delete a shopping list
	 */
	async deleteList(listId: string, userId: string): Promise<void> {
		const list = await this.shoppingListRepo.findById(listId);

		if (!list || list.userId !== userId) {
			throw new Error('Shopping list not found');
		}

		await this.shoppingListRepo.delete(listId);
	}

	/**
	 * Create a shopping list from one or more recipes
	 */
	async generateFromRecipes(
		userId: string,
		recipeIds: string[],
		name: string
	): Promise<ShoppingListWithItemsDao> {
		const list = await this.createList(userId, name);

		for (const recipeId of recipeIds) {
			await this.addRecipeIngredients(userId, list.id, recipeId);
		}

		const items = await this.shoppingListItemRepo.findByListId(list.id);

		return { ...list, items };
	}
}
