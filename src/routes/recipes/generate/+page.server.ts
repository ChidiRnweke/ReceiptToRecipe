import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { RecipeController, PreferencesController, PantryController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';
import { parseNumber, parseStringList } from '$lib/validation';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const preferencesController = new PreferencesController();
	const preferences = await preferencesController.getPreferences(locals.user.id);

	// Get user pantry items
	const pantryController = new PantryController(AppFactory.getPantryService());
	const pantry = await pantryController.getUserPantry(locals.user.id);

	return {
		preferences,
		pantry,
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
		const sourceReceiptId = data.get('sourceReceiptId')?.toString() || undefined;

		if (ingredientIds.length === 0 && customIngredients.length === 0) {
			return fail(400, { error: 'Please select or add at least one ingredient' });
		}

		try {
			const recipeController = new RecipeController(
				AppFactory.getLlmService(),
				AppFactory.getImageGenService(),
				AppFactory.getVectorService(),
                AppFactory.getTasteProfileService(),
				AppFactory.getJobQueue()
			);

			const recipe = await recipeController.generateRecipe({
				userId: locals.user.id,
				ingredientIds: ingredientIds.length > 0 ? ingredientIds : undefined,
				customIngredients: customIngredients.length > 0 ? customIngredients : undefined,
				servings,
				cuisineHint,
				sourceReceiptId
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
