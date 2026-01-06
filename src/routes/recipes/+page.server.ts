import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { RecipeController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService()
	);

	const recipes = await recipeController.getUserRecipes(locals.user.id);

	return {
		recipes
	};
};
