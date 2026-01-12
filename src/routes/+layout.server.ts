import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db/client';
import { receipts, recipes } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { ShoppingListController } from '$lib/controllers';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			user: null,
			workflowCounts: null
		};
	}

	const userId = locals.user.id;

	// Fetch counts for the workflow nav
	const [receiptCountRow, recipeCountRow] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(receipts).where(eq(receipts.userId, userId)),
		db.select({ count: sql<number>`count(*)` }).from(recipes).where(eq(recipes.userId, userId))
	]);

	const listController = new ShoppingListController();
	let shoppingItems = 0;
	try {
		const activeList = await listController.getActiveList(userId);
		shoppingItems = activeList.items?.filter(i => !i.checked).length || 0;
	} catch {
		// No active list
	}

	return {
		user: locals.user,
		workflowCounts: {
			receipts: Number(receiptCountRow[0]?.count) || 0,
			recipes: Number(recipeCountRow[0]?.count) || 0,
			shoppingItems
		}
	};
};
