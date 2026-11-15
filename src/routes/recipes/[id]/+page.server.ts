import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import type { LlmGeneratedRecipe } from '$lib/services';
import type { RecipeWithIngredients } from '$lib/controllers';

import { cookbookIdOf, isRecipeRef } from '$lib/models/recipes';

function toLlmRecipe(recipe: RecipeWithIngredients): LlmGeneratedRecipe {
	return {
		title: recipe.title,
		description: recipe.description || '',
		instructions: recipe.instructions,
		servings: recipe.servings,
		prepTime: recipe.prepTime || 0,
		cookTime: recipe.cookTime || 0,
		cuisineType: recipe.cuisineType || undefined,
		ingredients: recipe.ingredients.map((i) => ({
			name: i.name,
			quantity: typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity,
			unit: i.unit,
			optional: i.optional || false,
			notes: i.notes || undefined
		}))
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!isRecipeRef(params.id)) {
		throw error(404, 'Recipe not found');
	}

	const recipeController = AppFactory.getRecipeController();
	const viewer = locals.actor ?? null;
	const viewerId = viewer?.userId;

	// Stream everything - page shows skeleton immediately
	const recipeDataPromise = (async () => {
		const recipe = await recipeController.getRecipe(params.id, viewer);

		if (!recipe) {
			throw error(404, 'Recipe not found');
		}
		// A shared-cookbook recipe the household adopted opens as its own copy.
		if (recipe.id !== params.id) {
			throw redirect(302, `/recipes/${recipe.id}`);
		}

		// Load related data in parallel
		// Anyone in the recipe's household can manage it
		const isOwner = viewer !== null && viewer.householdId === recipe.householdId;
		const isSaved = viewer ? await recipeController.isSaved(viewer, recipe.id) : false;

		// Load source receipt if available — only the household may see its own receipts
		let sourceReceipt = null;
		if (recipe.sourceReceiptId && isOwner) {
			const receiptRepo = AppFactory.getReceiptRepository();
			const receipt = await receiptRepo.findById(recipe.sourceReceiptId);
			if (receipt && receipt.householdId === viewer.householdId) {
				sourceReceipt = {
					id: receipt.id,
					storeName: receipt.storeName,
					purchaseDate: receipt.purchaseDate,
					createdAt: receipt.createdAt
				};
			}
		}

		return {
			recipe,
			isSaved,
			isOwner,
			sourceReceipt
		};
	})();

	// Non-critical data - stream as promises
	const useItUp = AppFactory.getUseItUpController();
	const pantryMatchesPromise = viewer
		? recipeDataPromise.then(({ recipe }) => {
				return useItUp.listHome(viewer, new Date(), locals.timeZone).then((home) => {
					const pantry = home.filter((item) => !item.off);
					const matches: Record<string, number> = {};
					recipe.ingredients.forEach((ing) => {
						const ingName = ing.name.toLowerCase();
						const match = pantry.find((p) => {
							const pName = p.name.toLowerCase();
							return pName.includes(ingName) || ingName.includes(pName);
						});
						// 1 for an amount the household confirmed, less for an estimate.
						if (match) matches[ing.name] = match.known ? 1 : 0.6;
					});
					return matches;
				});
			})
		: Promise.resolve({});

	// AI suggestions - expensive operation, definitely stream this
	const suggestionsPromise = recipeDataPromise.then(({ recipe }) => {
		return (async () => {
			try {
				const llmService = AppFactory.getCulinaryIntelligence();
				const recipeForAi = toLlmRecipe(recipe);
				return await llmService.suggestModifications(recipeForAi);
			} catch (err) {
				console.warn('Failed to generate recipe suggestions:', err);
				return [];
			}
		})();
	});

	const allergyRiskPromise = viewerId
		? recipeDataPromise.then(({ recipe }) => {
				return (async () => {
					try {
						const llmService = AppFactory.getCulinaryIntelligence();
						const tasteProfileService = AppFactory.getTasteProfileService();
						const preferencesController = AppFactory.getPreferencesController();

						const [tasteProfile, preferences] = await Promise.all([
							tasteProfileService.getUserTasteProfile(viewerId),
							preferencesController.getPreferences(viewerId)
						]);

						const review = await llmService.reviewRecipeAllergyRisk({
							recipe: toLlmRecipe(recipe),
							allergies: tasteProfile.allergies,
							legacyAllergies: preferences?.allergies || []
						});

						if (review.riskLevel === 'medium' || review.riskLevel === 'high') {
							return review;
						}

						return null;
					} catch (err) {
						console.warn('Failed to review allergy risk:', err);
						return null;
					}
				})();
			})
		: Promise.resolve(null);

	return {
		// Stream everything - page shows skeleton immediately
		streamed: {
			recipeData: recipeDataPromise,
			pantryMatches: pantryMatchesPromise,
			suggestions: suggestionsPromise,
			allergyRisk: allergyRiskPromise
		}
	};
};

export const actions: Actions = {
	save: async ({ locals, params }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		// Saving a shared-cookbook recipe adopts it; the page then shows the household's copy.
		const recipeId = await recipeController.adopt(locals.actor, params.id);
		await recipeController.saveRecipe(locals.actor, recipeId);
		if (recipeId !== params.id) throw redirect(303, `/recipes/${recipeId}`);
		return { success: true };
	},
	unsave: async ({ locals, params }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		await recipeController.unsaveRecipe(locals.actor, params.id);
		return { success: true };
	},
	togglePublic: async ({ locals, params }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		const recipe = await recipeController.getRecipe(params.id, locals.actor);
		if (!recipe || recipe.householdId !== locals.actor.householdId) {
			throw error(403, 'Not allowed');
		}

		const isPublic = await recipeController.togglePublic(params.id, locals.actor);
		return { success: true, isPublic };
	},
	addToShopping: async ({ locals, params, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const excludePantry = formData.get('excludePantry') === 'true';

		const recipeController = AppFactory.getRecipeController();
		// Shopping for a shared-cookbook recipe adopts it, so the list can name the household's copy.
		const recipeId = cookbookIdOf(params.id)
			? await recipeController.adopt(locals.actor, params.id)
			: params.id;

		const recipe = await recipeController.getRecipe(recipeId, locals.actor);
		if (!recipe) {
			throw error(404, 'Recipe not found');
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.actor);

			// Get pantry items if excluding
			let pantryItems: string[] = [];
			if (excludePantry) {
				const home = await AppFactory.getUseItUpController().listHome(
					locals.actor,
					new Date(),
					locals.timeZone
				);
				pantryItems = home.filter((item) => !item.off).map((item) => item.name);
			}

			await listController.addRecipeIngredients(
				locals.actor,
				list.id,
				recipeId,
				excludePantry,
				pantryItems
			);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to add to shopping list'
			});
		}
	},
	delete: async ({ locals, params }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		try {
			await recipeController.deleteRecipe(params.id, locals.actor);
		} catch {
			throw error(403, 'Not allowed to delete this recipe');
		}

		throw redirect(302, '/recipes');
	},
	adjustRecipe: async ({ locals, params, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const instruction = formData.get('instruction') as string;

		if (!instruction || instruction.trim().length === 0) {
			return fail(400, { error: 'Adjustment instruction is required' });
		}

		const recipeController = AppFactory.getRecipeController();

		try {
			await recipeController.adjustRecipeWithAi(params.id, locals.actor, instruction.trim());
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to adjust recipe'
			});
		}
	}
};
