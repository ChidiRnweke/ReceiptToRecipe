import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { RecipeController, ShoppingListController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService(),
		AppFactory.getJobQueue()
	);

	const recipes = await recipeController.getUserRecipes(locals.user.id);

	// Get receipt count for empty state guidance
	const { db } = await import('$lib/db/client');
	const { receipts } = await import('$lib/db/schema');
	const { eq, sql } = await import('drizzle-orm');

	const [receiptCountResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(receipts)
		.where(eq(receipts.userId, locals.user.id));

	return {
		recipes,
		receiptCount: receiptCountResult?.count || 0
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const recipeId = formData.get('recipeId');

		if (!recipeId || typeof recipeId !== 'string') {
			throw error(400, 'Recipe ID is required');
		}

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
			AppFactory.getJobQueue()
		);

		try {
			await recipeController.deleteRecipe(recipeId, locals.user.id);
		} catch (err) {
			throw error(403, 'Not allowed to delete this recipe');
		}

		return { success: true };
	},

	addToShopping: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const recipeId = formData.get('recipeId')?.toString();

		if (!recipeId) {
			return fail(400, { error: 'Recipe ID is required' });
		}

		try {
			const listController = new ShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			await listController.addRecipeIngredients(list.id, recipeId);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, { error: err instanceof Error ? err.message : 'Failed to add to shopping list' });
		}
	}
};
