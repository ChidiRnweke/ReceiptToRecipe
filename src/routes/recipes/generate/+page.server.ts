import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { RecipeController, PreferencesController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { db } from '$lib/db/client';
import { receipts } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseNumber, parseStringList, requireString } from '$lib/validation';

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
		const ingredientIds = parseStringList(data.get('ingredientIds')?.toString(), {
			maxItems: 30,
			maxLength: 64
		});
		const customIngredients = parseStringList(data.get('customIngredients')?.toString(), {
			maxItems: 30,
			maxLength: 64
		});
		const servings = parseNumber(data.get('servings')?.toString(), {
			min: 1,
			max: 20,
			fallback: 2
		}) ?? 2;
		const cuisineHintRaw = data.get('cuisineHint')?.toString();
		const cuisineHint = cuisineHintRaw ? cuisineHintRaw.slice(0, 64) : undefined;

		if (ingredientIds.length === 0 && customIngredients.length === 0) {
			return fail(400, { error: 'Please select or add at least one ingredient' });
		}

		try {
			const recipeController = new RecipeController(
				AppFactory.getLlmService(),
				AppFactory.getImageGenService(),
				AppFactory.getVectorService(),
				AppFactory.getJobQueue()
			);

			const recipe = await recipeController.generateRecipe({
				userId: locals.user.id,
				ingredientIds: ingredientIds.length > 0 ? ingredientIds : undefined,
				customIngredients: customIngredients.length > 0 ? customIngredients : undefined,
				servings,
				cuisineHint
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
