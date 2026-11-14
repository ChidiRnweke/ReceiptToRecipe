import type { IShoppingListRepository, IShoppingListItemRepository } from '$repositories';
import type { IRecipeIngredientRepository } from '$repositories';
import type { IReceiptItemRepository } from '$repositories';
import type { IRecipeRepository, IReceiptRepository } from '$repositories';
import type { Actor } from '$lib/models/household';
import { normalizeItemKey } from '$lib/services/kitchen/itemKey';
import type { ShoppingListItemDao, ShoppingListWithItemsDao } from '$lib/repositories/daos';

export type { ShoppingListWithItemsDao as ShoppingListWithItems };

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
		private recipeIngredientRepo: IRecipeIngredientRepository,
		private receiptItemRepo: IReceiptItemRepository,
		private recipeRepo: IRecipeRepository,
		private receiptRepo: IReceiptRepository
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
			mergeKey: normalizeItemKey(input.name),
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
}
