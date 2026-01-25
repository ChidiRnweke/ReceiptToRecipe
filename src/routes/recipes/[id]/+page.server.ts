import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { RecipeController, PantryController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { ShoppingListController } from '$lib/controllers/ShoppingListController';
import { db } from '$lib/db/client';
import { receipts } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, params }) => {
	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService(),
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
	let pantryMatches = new Set<string>();
	if (viewerId) {
		const pantryController = new PantryController(AppFactory.getPantryService());
		const pantry = await pantryController.getUserPantry(viewerId);
		const pantrySet = new Set(pantry.map(i => i.itemName.toLowerCase()));
		
		recipe.ingredients.forEach(ing => {
			const ingName = ing.name.toLowerCase();
			if (Array.from(pantrySet).some(p => p.includes(ingName) || ingName.includes(p))) {
				pantryMatches.add(ing.name);
			}
		});
	}

	// Load source receipt if available
	let sourceReceipt = null;
	if (recipe.sourceReceiptId) {
		sourceReceipt = await db.query.receipts.findFirst({
			where: eq(receipts.id, recipe.sourceReceiptId),
			columns: {
				id: true,
				storeName: true,
				purchaseDate: true,
				createdAt: true
			}
		});
	}

	return {
		recipe,
		isSaved,
		isOwner,
		sourceReceipt,
		pantryMatches: Array.from(pantryMatches)
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
