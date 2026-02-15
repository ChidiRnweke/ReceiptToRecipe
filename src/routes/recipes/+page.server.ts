import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { TasteProfileController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const recipeController = AppFactory.getRecipeController();
	const pantryController = AppFactory.getPantryController();
	const receiptRepo = AppFactory.getReceiptRepository();

	// Start all async operations in parallel, don't await yet
	const recipesPromise = recipeController.getUserRecipesWithIngredients(locals.user.id);
	const pantryPromise = pantryController.getUserPantry(locals.user.id);
	const receiptCountPromise = receiptRepo.countByUserId(locals.user.id);

	// Return promises for streaming - page shell renders immediately
	return {
		streamed: {
			recipesData: Promise.all([recipesPromise, pantryPromise]).then(async ([recipes, pantry]) => {
				const tasteProfileController = new TasteProfileController(
					AppFactory.getTasteProfileService()
				);
				const pantrySet = new Set(pantry.map((i) => i.itemName.toLowerCase()));

				// Augment recipes with suggestion data
				const augmentedRecipes = await Promise.all(
					recipes.map(async (recipe) => {
						let matchCount = 0;
						const totalIngredients = recipe.ingredients.length;
						const missingIngredients = [];

						for (const ing of recipe.ingredients) {
							const ingName = ing.name.toLowerCase();
							const isMatch = Array.from(pantrySet).some(
								(pItem) => pItem.includes(ingName) || ingName.includes(pItem)
							);

							if (isMatch) {
								matchCount++;
							} else {
								missingIngredients.push(ing.name);
							}
						}

						const matchPercentage = totalIngredients > 0 ? matchCount / totalIngredients : 0;

						// Check compatibility
						const compatibility = await tasteProfileController.checkCompatibility(
							locals.user!.id,
							recipe.id
						);

						return {
							...recipe,
							matchCount,
							totalIngredients,
							matchPercentage,
							missingIngredients,
							compatibility,
							isSuggested: matchPercentage >= 0.7
						};
					})
				);

				return {
					recipes: augmentedRecipes,
					receiptCount: await receiptCountPromise
				};
			})
		}
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

		const recipeController = AppFactory.getRecipeController();

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
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			await listController.addRecipeIngredients(locals.user.id, list.id, recipeId);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add to shopping list'
			});
		}
	}
};
