import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { receipts, recipes, savedRecipes } from '$lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { ShoppingListController } from '$lib/controllers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userId = locals.user.id;

	const [receiptCountRow, recipeCountRow, savedCountRow] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(receipts).where(eq(receipts.userId, userId)).limit(1),
		db.select({ count: sql<number>`count(*)` }).from(recipes).where(eq(recipes.userId, userId)).limit(1),
		db.select({ count: sql<number>`count(*)` }).from(savedRecipes).where(eq(savedRecipes.userId, userId)).limit(1)
	]);

	const recentReceipts = await db.query.receipts.findMany({
		where: eq(receipts.userId, userId),
		orderBy: [desc(receipts.createdAt)],
		limit: 3
	});

	const recentRecipes = await db.query.recipes.findMany({
		where: eq(recipes.userId, userId),
		orderBy: [desc(recipes.createdAt)],
		limit: 3
	});

	const listController = new ShoppingListController();
	const activeList = await listController.getActiveList(userId);
	const suggestions = await listController.getSmartSuggestions(userId, 5);

	return {
		user: locals.user,
		metrics: {
			receipts: receiptCountRow[0]?.count || 0,
			recipes: recipeCountRow[0]?.count || 0,
			saved: savedCountRow[0]?.count || 0,
			activeListItems: activeList.items?.length || 0
		},
		recentReceipts,
		recentRecipes,
		suggestions
	};
};
