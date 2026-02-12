import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { TasteProfileController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

			const recipeController = AppFactory.getRecipeController();
	const recipes = await recipeController.getUserRecipesWithIngredients(locals.user.id);

	// Get pantry
	const pantryController = AppFactory.getPantryController();
	const pantry = await pantryController.getUserPantry(locals.user.id);
	
    // Get Taste Profile
    const tasteProfileController = new TasteProfileController(AppFactory.getTasteProfileService());
    // Optimization: We could fetch profile once and pass it to a sync helper, but checkCompatibility is async.
    // For many recipes, we should do this efficiently. 
    // Ideally checkRecipeCompatibility in service should take a profile object, but it fetches it.
    // Let's iterate.

	// Create a map of pantry normalized names for fast lookup
	const pantrySet = new Set(pantry.map(i => i.itemName.toLowerCase()));

	// Augment recipes with suggestion data
	const augmentedRecipes = await Promise.all(recipes.map(async (recipe) => {
		let matchCount = 0;
		const totalIngredients = recipe.ingredients.length;
		
		const missingIngredients = [];

		for (const ing of recipe.ingredients) {
			const ingName = ing.name.toLowerCase();
			const isMatch = Array.from(pantrySet).some(pItem => 
				pItem.includes(ingName) || ingName.includes(pItem)
			);
			
			if (isMatch) {
				matchCount++;
			} else {
				missingIngredients.push(ing.name);
			}
		}

		const matchPercentage = totalIngredients > 0 ? matchCount / totalIngredients : 0;

        // Check compatibility
        const compatibility = await tasteProfileController.checkCompatibility(locals.user!.id, recipe.id);

		return {
			...recipe,
			matchCount,
			totalIngredients,
			matchPercentage,
			missingIngredients,
            compatibility,
			isSuggested: matchPercentage >= 0.7
		};
	}));

	// Get receipt count for empty state guidance
	const receiptRepo = AppFactory.getReceiptRepository();
	const receiptCount = await receiptRepo.countByUserId(locals.user.id);

	return {
		recipes: augmentedRecipes,
		receiptCount
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
			return fail(500, { error: err instanceof Error ? err.message : 'Failed to add to shopping list' });
		}
	}
};
