import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import { parseNumber, parseStringList } from '$lib/validation';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) {
		throw redirect(302, '/login');
	}

	const preferencesController = AppFactory.getPreferencesController();
	const preferences = await preferencesController.getPreferences(locals.actor.userId);

	// Everything the kitchen holds, gone-off items included, since people may still have them.
	// The page pre-selects only the items that have not gone off.
	const pantryPromise = AppFactory.getUseItUpController().listHome(
		locals.actor,
		new Date(),
		locals.timeZone
	);

	return {
		preferences,
		streamed: {
			pantry: pantryPromise
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.actor) {
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
		const servings =
			parseNumber(data.get('servings')?.toString(), {
				min: 1,
				max: 20,
				fallback: 2
			}) ?? 2;
		const cuisineHintRaw = data.get('cuisineHint')?.toString();
		const cuisineHint = cuisineHintRaw ? cuisineHintRaw.slice(0, 64) : undefined;
		const sourceReceiptId = data.get('sourceReceiptId')?.toString() || undefined;

		if (ingredientIds.length === 0 && customIngredients.length === 0) {
			return fail(400, {
				error: 'Please select or add at least one ingredient'
			});
		}

		try {
			const recipeController = AppFactory.getRecipeController();

			const recipe = await recipeController.generateRecipe({
				actor: locals.actor,
				ingredientIds: ingredientIds.length > 0 ? ingredientIds : undefined,
				customIngredients: customIngredients.length > 0 ? customIngredients : undefined,
				servings,
				cuisineHint,
				sourceReceiptId
			});

			throw redirect(302, `/recipes/${recipe.id}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate recipe'
			});
		}
	}
};
