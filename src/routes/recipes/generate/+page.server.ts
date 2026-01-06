import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { RecipeController, PreferencesController, ReceiptController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { db } from '$lib/db/client';
import { receipts, receiptItems } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const preferencesController = new PreferencesController();
	const preferences = await preferencesController.getPreferences(locals.user.id);

	// Get recent receipts with items
	const recentReceipts = await db.query.receipts.findMany({
		where: eq(receipts.userId, locals.user.id),
		orderBy: [desc(receipts.createdAt)],
		limit: 5,
		with: {
			items: true
		}
	});

	// Filter to only show completed receipts with items
	const receiptsWithItems = recentReceipts.filter(
		(r) => r.status === 'DONE' && r.items && r.items.length > 0
	);

	// Pre-select receipt items if receiptId is in URL
	const receiptId = url.searchParams.get('receipt');

	return {
		preferences,
		recentReceipts: receiptsWithItems,
		preSelectedReceiptId: receiptId
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const ingredientIdsStr = data.get('ingredientIds')?.toString() || '';
		const customIngredientsStr = data.get('customIngredients')?.toString() || '';
		const servings = parseInt(data.get('servings')?.toString() || '2');
		const cuisineHint = data.get('cuisineHint')?.toString() || undefined;
		const useRag = data.get('useRag') === 'on';

		const ingredientIds = ingredientIdsStr ? ingredientIdsStr.split(',').filter(Boolean) : [];
		const customIngredients = customIngredientsStr
			? customIngredientsStr.split(',').filter(Boolean)
			: [];

		if (ingredientIds.length === 0 && customIngredients.length === 0) {
			return fail(400, { error: 'Please select or add at least one ingredient' });
		}

		try {
			const recipeController = new RecipeController(
				AppFactory.getLlmService(),
				AppFactory.getImageGenService(),
				AppFactory.getVectorService()
			);

			const recipe = await recipeController.generateRecipe({
				userId: locals.user.id,
				ingredientIds: ingredientIds.length > 0 ? ingredientIds : undefined,
				customIngredients: customIngredients.length > 0 ? customIngredients : undefined,
				servings,
				cuisineHint,
				useRag
			});

			throw redirect(302, `/recipes/${recipe.id}`);
		} catch (error) {
			if (error instanceof Response) throw error;
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate recipe'
			});
		}
	}
};
