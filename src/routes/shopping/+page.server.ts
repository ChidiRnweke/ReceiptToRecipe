import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ShoppingListController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { db } from '$lib/db/client';
import { shoppingLists, shoppingListItems, recipes } from '$lib/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const shoppingListController = new ShoppingListController();

	const [activeList, lists, suggestions] = await Promise.all([
		shoppingListController.getActiveList(locals.user.id),
		shoppingListController.getUserLists(locals.user.id),
		shoppingListController.getSmartSuggestions(locals.user.id)
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
		const recipeList = await db.query.recipes.findMany({
			where: inArray(recipes.id, Array.from(recipeIds)),
			columns: { id: true, title: true }
		});
		recipeMap = Object.fromEntries(recipeList.map(r => [r.id, r]));
	}

	// Get counts for empty state guidance
	const recipeCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(recipes)
		.where(eq(recipes.userId, locals.user.id));

	return {
		activeList,
		lists,
		suggestions,
		recipeMap,
		recipeCount: recipeCount[0]?.count || 0
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
			const shoppingListController = new ShoppingListController();
			await shoppingListController.completeShopping(listId);
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
			const shoppingListController = new ShoppingListController();
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
			const shoppingListController = new ShoppingListController();
			const list = await shoppingListController.createRestockList(locals.user.id, AppFactory.getLlmService());
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

		if (!listId || !name) {
			return fail(400, { error: 'List ID and item name are required' });
		}

		try {
			const shoppingListController = new ShoppingListController();
			await shoppingListController.addItem(listId, {
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
			const shoppingListController = new ShoppingListController();
			await shoppingListController.toggleItem(itemId, checked);
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
			const shoppingListController = new ShoppingListController();
			await shoppingListController.removeItem(itemId);
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
			const shoppingListController = new ShoppingListController();
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
			const shoppingListController = new ShoppingListController();
			const list = await shoppingListController.generateFromRecipes(locals.user.id, recipeIds, listName);
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
			const shoppingListController = new ShoppingListController();
			await shoppingListController.addSuggestion(listId, {
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
