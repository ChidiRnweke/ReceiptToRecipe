import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db/client';
import { receipts, recipes, savedRecipes, shoppingLists, recipeIngredients } from '$lib/db/schema';
import { desc, eq, sql, and } from 'drizzle-orm';
import { ShoppingListController, PantryController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null };
	}

	const userId = locals.user.id;

	const [receiptCountRow, recipeCountRow, savedCountRow, activeList] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(receipts).where(eq(receipts.userId, userId)).limit(1),
		db.select({ count: sql<number>`count(*)` }).from(recipes).where(eq(recipes.userId, userId)).limit(1),
		db.select({ count: sql<number>`count(*)` }).from(savedRecipes).where(eq(savedRecipes.userId, userId)).limit(1),
		db.query.shoppingLists.findFirst({ where: and(eq(shoppingLists.userId, userId), eq(shoppingLists.isActive, true)), with: { items: true } })
	]);

	const recentReceipts = await db.query.receipts.findMany({
		where: eq(receipts.userId, userId),
		orderBy: [desc(receipts.createdAt)],
		limit: 3
	});

	// Load recent recipes with ingredients for the featured recipe
	const recentRecipes = await db.query.recipes.findMany({
		where: eq(recipes.userId, userId),
		orderBy: [desc(recipes.createdAt)],
		limit: 6,
		with: {
			ingredients: {
				orderBy: [recipeIngredients.orderIndex],
				limit: 8
			}
		}
	});

	const listController = new ShoppingListController();
	const suggestions = await listController.getSmartSuggestions(userId, 5);

	const pantryController = new PantryController(AppFactory.getPantryService());
	const pantry = await pantryController.getUserPantry(userId);

	// Calculate shopping list stats
	const activeListStats = activeList?.items ? {
		totalItems: activeList.items.length,
		checkedItems: activeList.items.filter(i => i.checked).length,
		completionPercent: activeList.items.length > 0
			? Math.round((activeList.items.filter(i => i.checked).length / activeList.items.length) * 100)
			: 0
	} : null;

	return {
		user: locals.user,
		metrics: {
			receipts: receiptCountRow[0]?.count || 0,
			recipes: recipeCountRow[0]?.count || 0,
			saved: savedCountRow[0]?.count || 0,
			activeListItems: activeList?.items?.length || 0
		},
		recentReceipts,
		recentRecipes,
		suggestions,
		pantry,
		activeList: activeList ? {
			id: activeList.id,
			name: activeList.name,
			items: activeList.items,
			stats: activeListStats
		} : null
	};
};

export const actions: Actions = {
	toggleIngredient: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const ingredientName = data.get('ingredientName')?.toString();

		if (!ingredientName) {
			return fail(400, { error: 'Ingredient name is required' });
		}

		try {
			const listController = new ShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			
			// Check if item exists
			const existingItem = list.items.find(i => i.name === ingredientName);

			if (existingItem) {
				await listController.removeItem(existingItem.id);
				return { success: true, removed: ingredientName };
			} else {
				await listController.addItem(list.id, {
					name: ingredientName,
					quantity: '1',
					unit: ''
				});
				return { success: true, added: ingredientName };
			}
		} catch (error) {
			return fail(500, { error: error instanceof Error ? error.message : 'Failed to update list' });
		}
	}
};
