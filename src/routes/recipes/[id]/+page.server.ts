import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RecipeController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService()
	);

	const recipe = await recipeController.getRecipe(params.id, locals.user.id);

	if (!recipe) {
		throw error(404, 'Recipe not found');
	}

	return {
		recipe
	};
};
