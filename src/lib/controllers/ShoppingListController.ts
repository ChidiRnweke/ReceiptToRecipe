import type { IShoppingListRepository, IShoppingListItemRepository } from '$repositories';
import type { IPurchaseHistoryRepository } from '$repositories';
import type { IRecipeIngredientRepository } from '$repositories';
import type { IReceiptItemRepository } from '$repositories';
import type { IRecipeRepository, IReceiptRepository } from '$repositories';
import type { Actor } from '$lib/models/household';
import type { ICulinaryIntelligence, IKitchenService } from '$lib/services';
import { dayNumber } from '$lib/services/kitchen';
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
		private receiptItemRepo: IReceiptItemRepository,
		private recipeRepo: IRecipeRepository,
		private receiptRepo: IReceiptRepository,
		private kitchenService: IKitchenService
	) {}

	/**
	 * Helper to verify list ownership
	 */
	private async verifyListOwnership(actor: Actor, listId: string): Promise<void> {
		const list = await this.shoppingListRepo.findById(listId);
		if (!list) throw new Error('List not found');
		if (list.householdId !== actor.householdId) {
			throw new Error('Unauthorized access to shopping list');
		}
	}

	/**
	 * Helper to verify item ownership (via list)
	 */
	private async verifyItemOwnership(actor: Actor, itemId: string): Promise<void> {
		const item = await this.shoppingListItemRepo.findById(itemId);
		if (!item) throw new Error('Item not found');
		await this.verifyListOwnership(actor, item.shoppingListId);
	}

	/**
	 * Get or create the household's active shopping list
	 */
	async getActiveList(actor: Actor): Promise<ShoppingListWithItemsDao> {
		const existing = await this.shoppingListRepo.findActiveByHouseholdId(actor.householdId);
		if (existing) return existing;

		const newList = await this.shoppingListRepo.create({
			userId: actor.userId,
			householdId: actor.householdId,
			name: 'Shopping List',
			isActive: true
		});

		return { ...newList, items: [] };
	}

	/**
	 * Get all of the household's shopping lists
	 */
	async getHouseholdLists(actor: Actor): Promise<ShoppingListWithItemsDao[]> {
		return this.shoppingListRepo.findByHouseholdId(actor.householdId);
	}

	/**
	 * Create a new shopping list
	 */
	async createList(actor: Actor, name: string): Promise<ShoppingListDao> {
		// Deactivate existing lists
		await this.shoppingListRepo.deactivateAllByHouseholdId(actor.householdId);

		return this.shoppingListRepo.create({
			userId: actor.userId,
			householdId: actor.householdId,
			name,
			isActive: true
		});
	}

	/**
	 * Add an item to the shopping list
	 */
	async addItem(actor: Actor, listId: string, input: AddItemInput): Promise<ShoppingListItemDao> {
		await this.verifyListOwnership(actor, listId);

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
		actor: Actor,
		listId: string,
		recipeId: string,
		excludeInStock: boolean = false,
		pantryItems: string[] = []
	): Promise<ShoppingListItemDao[]> {
		await this.verifyListOwnership(actor, listId);

		const recipe = await this.recipeRepo.findById(recipeId);
		if (!recipe || (!recipe.isPublic && recipe.householdId !== actor.householdId)) {
			throw new Error('Recipe not found');
		}

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

			const item = await this.addItem(actor, listId, {
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
		actor: Actor,
		listId: string,
		receiptId: string
	): Promise<ShoppingListItemDao[]> {
		await this.verifyListOwnership(actor, listId);

		const receipt = await this.receiptRepo.findById(receiptId);
		if (!receipt || receipt.householdId !== actor.householdId) {
			throw new Error('Receipt not found');
		}

		const items = await this.receiptItemRepo.findByReceiptId(receiptId);

		const results: ShoppingListItemDao[] = [];
		for (const item of items) {
			const created = await this.addItem(actor, listId, {
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
	async toggleItem(actor: Actor, itemId: string, checked?: boolean): Promise<ShoppingListItemDao> {
		await this.verifyItemOwnership(actor, itemId);

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
	async removeItem(actor: Actor, itemId: string): Promise<void> {
		await this.verifyItemOwnership(actor, itemId);
		await this.shoppingListItemRepo.delete(itemId);
	}

	/**
	 * Clear all checked items from a list
	 */
	async clearCheckedItems(actor: Actor, listId: string): Promise<void> {
		await this.verifyListOwnership(actor, listId);
		await this.shoppingListItemRepo.deleteCheckedByListId(listId);
	}

	/**
	 * Complete shopping: move checked items to purchase history and clear them
	 */
	async completeShopping(actor: Actor, listId: string): Promise<void> {
		await this.verifyListOwnership(actor, listId);

		const checkedItems = await this.shoppingListItemRepo.findCheckedByListId(listId);

		if (checkedItems.length === 0) return;

		const now = new Date();

		// Update purchase history
		for (const item of checkedItems) {
			const existing = await this.purchaseHistoryRepo.findByHouseholdAndItem(
				actor.householdId,
				item.name
			);

			if (existing) {
				// Days between shops count the household's local calendar days.
				const daysSinceLastPurchase =
					dayNumber(now, actor.timeZone) - dayNumber(existing.lastPurchased, actor.timeZone);
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
					userId: actor.userId,
					householdId: actor.householdId,
					itemName: item.name,
					lastPurchased: now,
					purchaseCount: 1,
					avgQuantity: item.quantity || undefined,
					avgFrequencyDays: null
				});
			}
		}

		// Ticking the list closes the shop: the kitchen now holds what was ticked.
		await this.kitchenService.recordShopDone({
			author: actor,
			method: 'TICK',
			items: checkedItems.map((item) => ({
				name: item.name,
				quantity: item.quantity ? parseFloat(item.quantity) : null,
				unit: item.unit
			})),
			at: now,
			details: { shoppingListId: listId }
		});

		// Clear checked items
		await this.clearCheckedItems(actor, listId);
	}

	/**
	 * Get smart suggestions based on purchase history
	 */
	async getSmartSuggestions(actor: Actor, limit: number = 10): Promise<SmartSuggestion[]> {
		const suggestions = await this.purchaseHistoryRepo.findSuggestions(actor.householdId, limit);
		return suggestions;
	}

	/**
	 * Add a suggested item to the shopping list
	 */
	async addSuggestion(
		actor: Actor,
		listId: string,
		suggestion: SmartSuggestion
	): Promise<ShoppingListItemDao> {
		return this.addItem(actor, listId, {
			name: suggestion.itemName,
			quantity: suggestion.suggestedQuantity || undefined,
			notes: `Suggested based on ~${suggestion.avgFrequencyDays} day purchase cycle`
		});
	}

	/**
	 * Build a restock shopping list using history and culinary intelligence reasoning
	 */
	async createRestockList(
		actor: Actor,
		culinaryIntelligence: ICulinaryIntelligence
	): Promise<ShoppingListWithItemsDao> {
		const history = await this.purchaseHistoryRepo.findByHouseholdId(actor.householdId);

		if (history.length === 0) {
			throw new Error('No purchase history yet');
		}

		const name = `Restock · ${new Date().toLocaleDateString()}`;
		const list = await this.createList(actor, name);

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
			const suggestions = await this.getSmartSuggestions(actor, 15);
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
	async reorderItems(actor: Actor, listId: string, itemIds: string[]): Promise<void> {
		await this.verifyListOwnership(actor, listId);
		const listItemIds = new Set(
			(await this.shoppingListItemRepo.findByListId(listId)).map((item) => item.id)
		);
		if (itemIds.some((itemId) => !listItemIds.has(itemId))) {
			throw new Error('Item not found');
		}
		for (let i = 0; i < itemIds.length; i++) {
			await this.shoppingListItemRepo.updateOrderIndex(itemIds[i], i);
		}
	}

	/**
	 * Delete a shopping list
	 */
	async deleteList(listId: string, actor: Actor): Promise<void> {
		const list = await this.shoppingListRepo.findById(listId);

		if (!list || list.householdId !== actor.householdId) {
			throw new Error('Shopping list not found');
		}

		await this.shoppingListRepo.delete(listId);
	}

	/**
	 * Create a shopping list from one or more recipes
	 */
	async generateFromRecipes(
		actor: Actor,
		recipeIds: string[],
		name: string
	): Promise<ShoppingListWithItemsDao> {
		const list = await this.createList(actor, name);

		for (const recipeId of recipeIds) {
			await this.addRecipeIngredients(actor, list.id, recipeId);
		}

		const items = await this.shoppingListItemRepo.findByListId(list.id);

		return { ...list, items };
	}
}
