import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { RecipeController, PantryController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { ShoppingListController } from '$lib/controllers/ShoppingListController';

export const load: PageServerLoad = async ({ locals, params }) => {
	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService(),
        AppFactory.getTasteProfileService(),
		AppFactory.getJobQueue()
	);

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
		const pantryController = new PantryController(AppFactory.getPantryService());
		const pantry = await pantryController.getUserPantry(viewerId);
		
		recipe.ingredients.forEach(ing => {
			const ingName = ing.name.toLowerCase();
			// Find the best match in pantry
			const match = pantry.find(p => {
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

	return {
		recipe,
		isSaved,
		isOwner,
		sourceReceipt,
		pantryMatches
	};
};

export const actions: Actions = {
	save: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
            AppFactory.getTasteProfileService(),
			AppFactory.getJobQueue()
		);

		await recipeController.saveRecipe(locals.user.id, params.id);
		return { success: true };
	},
	unsave: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
            AppFactory.getTasteProfileService(),
			AppFactory.getJobQueue()
		);

		await recipeController.unsaveRecipe(locals.user.id, params.id);
		return { success: true };
	},
	togglePublic: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
            AppFactory.getTasteProfileService(),
			AppFactory.getJobQueue()
		);

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

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
            AppFactory.getTasteProfileService(),
			AppFactory.getJobQueue()
		);

		const recipe = await recipeController.getRecipe(params.id, locals.user.id);
		if (!recipe) {
			throw error(404, 'Recipe not found');
		}

		try {
			const listController = new ShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			
			// Get pantry items if excluding
			let pantryItems: string[] = [];
			if (excludePantry) {
				const pantryController = new PantryController(AppFactory.getPantryService());
				const pantry = await pantryController.getUserPantry(locals.user.id);
				pantryItems = pantry.map(i => i.itemName);
			}

			await listController.addRecipeIngredients(list.id, params.id, excludePantry, pantryItems);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, { error: err instanceof Error ? err.message : 'Unable to add to shopping list' });
		}
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
            AppFactory.getTasteProfileService(),
			AppFactory.getJobQueue()
		);

		try {
			await recipeController.deleteRecipe(params.id, locals.user.id);
		} catch (err) {
			throw error(403, 'Not allowed to delete this recipe');
		}

		throw redirect(302, '/recipes');
	}
};
