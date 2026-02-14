import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import type { PantryItem } from '$lib/services/PantryService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const shoppingListController = AppFactory.getShoppingListController();
	const pantryController = AppFactory.getPantryController();

	const [activeList, lists, suggestions, pantry] = await Promise.all([
		shoppingListController.getActiveList(locals.user.id),
		shoppingListController.getUserLists(locals.user.id),
		shoppingListController.getSmartSuggestions(locals.user.id),
		pantryController.getUserPantry(locals.user.id)
	]);

	// Collect all recipe IDs from shopping list items
	const recipeIds = new Set<string>();
	for (const list of lists) {
		for (const item of list.items || []) {
			if (item.fromRecipeId) {
				recipeIds.add(item.fromRecipeId);
			}
		}
	}

	// Load recipe info for source attribution
	let recipeMap: Record<string, { id: string; title: string }> = {};
	if (recipeIds.size > 0) {
		const recipeRepo = AppFactory.getRecipeRepository();
		const recipeList = await recipeRepo.findByIds(Array.from(recipeIds));
		recipeMap = Object.fromEntries(recipeList.map((r) => [r.id, { id: r.id, title: r.title }]));
	}

	// Get counts for empty state guidance
	const recipeRepo = AppFactory.getRecipeRepository();
	const recipeCount = await recipeRepo.countByUserId(locals.user.id);

	// Build pantry lookup map for quick duplicate checks (items with >70% confidence)
	const pantryLookup: Record<
		string,
		{ confidence: number; lastPurchased: Date; daysSincePurchase: number }
	> = {};
	for (const item of pantry) {
		if (item.stockConfidence >= 0.7) {
			pantryLookup[item.itemName.toLowerCase()] = {
				confidence: item.stockConfidence,
				lastPurchased: item.lastPurchased,
				daysSincePurchase: item.daysSincePurchase
			};
		}
	}

	return {
		activeList,
		lists,
		suggestions,
		recipeMap,
		recipeCount,
		pantry,
		pantryLookup
	};
};

export const actions: Actions = {
	completeShopping: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();

		if (!listId) {
			return fail(400, { error: 'List ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.completeShopping(locals.user.id, listId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to complete shopping'
			});
		}
	},

	createList: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString() || 'Shopping List';

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.createList(locals.user.id, name);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to create list'
			});
		}
	},

	generateRestock: async ({ locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.createRestockList(
				locals.user.id,
				AppFactory.getLlmService()
			);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate restock list'
			});
		}
	},

	addItem: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const name = data.get('name')?.toString().trim();
		const quantity = data.get('quantity')?.toString().trim();
		const unit = data.get('unit')?.toString().trim();
		const skipPantryCheck = data.get('skipPantryCheck') === 'true';

		if (!listId || !name) {
			return fail(400, { error: 'List ID and item name are required' });
		}

		try {
			// Check pantry for duplicates unless user explicitly wants to add anyway
			if (!skipPantryCheck) {
				const pantryCtrl = AppFactory.getPantryController();
				const pantry = await pantryCtrl.getUserPantry(locals.user.id);

				const nameLC = name.toLowerCase();
				const pantryMatch = pantry.find(
					(p) =>
						p.stockConfidence >= 0.7 &&
						(p.itemName.toLowerCase() === nameLC ||
							p.itemName.toLowerCase().includes(nameLC) ||
							nameLC.includes(p.itemName.toLowerCase()))
				);

				if (pantryMatch) {
					const daysAgo = pantryMatch.daysSincePurchase;
					const dateStr = pantryMatch.lastPurchased.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric'
					});
					return {
						pantryWarning: true,
						warningMessage: `You might already have "${pantryMatch.itemName}" (bought ${dateStr}, ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)`,
						matchedItem: pantryMatch.itemName,
						confidence: Math.round(pantryMatch.stockConfidence * 100),
						pendingItem: {
							name,
							quantity: quantity || '1',
							unit: unit || 'count',
							listId
						}
					};
				}
			}

			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.addItem(locals.user.id, listId, {
				name,
				quantity: quantity || '1',
				unit: unit || 'count'
			});
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to add item'
			});
		}
	},

	toggleItem: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const checked = data.get('checked') === 'true';

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.toggleItem(locals.user.id, itemId, checked);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update item'
			});
		}
	},

	deleteItem: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.removeItem(locals.user.id, itemId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete item'
			});
		}
	},

	deleteList: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();

		if (!listId) {
			return fail(400, { error: 'List ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.deleteList(listId, locals.user.id);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete list'
			});
		}
	},

	generateFromRecipes: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const recipeIdsStr = data.get('recipeIds')?.toString() || '';
		const listName = data.get('listName')?.toString() || 'Recipe Shopping List';

		const recipeIds = recipeIdsStr.split(',').filter(Boolean);

		if (recipeIds.length === 0) {
			return fail(400, { error: 'Please select at least one recipe' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.generateFromRecipes(
				locals.user.id,
				recipeIds,
				listName
			);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate shopping list'
			});
		}
	},

	addSuggestion: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const itemName = data.get('itemName')?.toString();
		const suggestedQuantity = data.get('suggestedQuantity')?.toString() || null;
		const avgFrequencyDays = data.get('avgFrequencyDays')
			? parseInt(data.get('avgFrequencyDays')!.toString())
			: null;
		const lastPurchased = data.get('lastPurchased')?.toString();
		const daysSinceLastPurchase = data.get('daysSinceLastPurchase')
			? parseInt(data.get('daysSinceLastPurchase')!.toString())
			: 0;

		if (!listId || !itemName || !lastPurchased) {
			return fail(400, { error: 'Missing suggestion data' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.addSuggestion(locals.user.id, listId, {
				itemName,
				suggestedQuantity,
				avgFrequencyDays,
				lastPurchased: new Date(lastPurchased),
				daysSinceLastPurchase
			});
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to add suggestion'
			});
		}
	}
};
