import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals, params }) => {
	const recipeController = AppFactory.getRecipeController();

	const viewerId = locals.user?.id;
	const recipe = await recipeController.getRecipe(params.id, viewerId);

	if (!recipe) {
		throw error(404, 'Recipe not found');
	}

	const isSaved = viewerId ? await recipeController.isSaved(viewerId, recipe.id) : false;
	const isOwner = viewerId === recipe.userId;

	// Load pantry for matching
	let pantryMatches: Record<string, number> = {};
	if (viewerId) {
		const pantryController = AppFactory.getPantryController();
		const pantry = await pantryController.getUserPantry(viewerId);

		recipe.ingredients.forEach((ing) => {
			const ingName = ing.name.toLowerCase();
			// Find the best match in pantry
			const match = pantry.find((p) => {
				const pName = p.itemName.toLowerCase();
				return pName.includes(ingName) || ingName.includes(pName);
			});

			if (match) {
				pantryMatches[ing.name] = match.stockConfidence;
			}
		});
	}

	// Load source receipt if available
	let sourceReceipt = null;
	if (recipe.sourceReceiptId) {
		const receiptRepo = AppFactory.getReceiptRepository();
		const receipt = await receiptRepo.findById(recipe.sourceReceiptId);
		if (receipt) {
			sourceReceipt = {
				id: receipt.id,
				storeName: receipt.storeName,
				purchaseDate: receipt.purchaseDate,
				createdAt: receipt.createdAt
			};
		}
	}

	// Generate AI suggestions for modifications
	let suggestions: string[] = [];
	try {
		const llmService = AppFactory.getCulinaryIntelligence();
		// Map DB recipe to GeneratedRecipe interface for the AI service
		const recipeForAi = {
			title: recipe.title,
			description: recipe.description || '',
			instructions: recipe.instructions,
			servings: recipe.servings,
			prepTime: recipe.prepTime || 0,
			cookTime: recipe.cookTime || 0,
			cuisineType: recipe.cuisineType || undefined,
			ingredients: recipe.ingredients.map((i: any) => ({
				name: i.name,
				quantity: typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity,
				unit: i.unit,
				optional: i.optional || false,
				notes: i.notes || undefined
			}))
		};
		suggestions = await llmService.suggestModifications(recipeForAi);
	} catch (err) {
		console.warn('Failed to generate recipe suggestions:', err);
		// Keep empty on error
	}

	return {
		recipe,
		isSaved,
		isOwner,
		sourceReceipt,
		pantryMatches,
		suggestions
	};
};

export const actions: Actions = {
	save: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		await recipeController.saveRecipe(locals.user.id, params.id);
		return { success: true };
	},
	unsave: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		await recipeController.unsaveRecipe(locals.user.id, params.id);
		return { success: true };
	},
	togglePublic: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		const recipe = await recipeController.getRecipe(params.id, locals.user.id);
		if (!recipe || recipe.userId !== locals.user.id) {
			throw error(403, 'Not allowed');
		}

		const isPublic = await recipeController.togglePublic(params.id, locals.user.id);
		return { success: true, isPublic };
	},
	addToShopping: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const excludePantry = formData.get('excludePantry') === 'true';

		const recipeController = AppFactory.getRecipeController();

		const recipe = await recipeController.getRecipe(params.id, locals.user.id);
		if (!recipe) {
			throw error(404, 'Recipe not found');
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.user.id);

			// Get pantry items if excluding
			let pantryItems: string[] = [];
			if (excludePantry) {
				const pantryController = AppFactory.getPantryController();
				const pantry = await pantryController.getUserPantry(locals.user.id);
				pantryItems = pantry.map((i: { itemName: string }) => i.itemName);
			}

			await listController.addRecipeIngredients(
				locals.user.id,
				list.id,
				params.id,
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
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = AppFactory.getRecipeController();

		try {
			await recipeController.deleteRecipe(params.id, locals.user.id);
		} catch (err) {
			throw error(403, 'Not allowed to delete this recipe');
		}

		throw redirect(302, '/recipes');
	},
	adjustRecipe: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const instruction = formData.get('instruction') as string;

		if (!instruction || instruction.trim().length === 0) {
			return fail(400, { error: 'Adjustment instruction is required' });
		}

		const recipeController = AppFactory.getRecipeController();

		try {
			await recipeController.adjustRecipeWithAi(params.id, locals.user.id, instruction.trim());
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to adjust recipe'
			});
		}
	}
};
