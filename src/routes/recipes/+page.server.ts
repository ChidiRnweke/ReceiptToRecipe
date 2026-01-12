import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { RecipeController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const recipeController = new RecipeController(
		AppFactory.getLlmService(),
		AppFactory.getImageGenService(),
		AppFactory.getVectorService(),
		AppFactory.getJobQueue()
	);

	const recipes = await recipeController.getUserRecipes(locals.user.id);

	return {
		recipes
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

		const recipeController = new RecipeController(
			AppFactory.getLlmService(),
			AppFactory.getImageGenService(),
			AppFactory.getVectorService(),
			AppFactory.getJobQueue()
		);

		try {
			await recipeController.deleteRecipe(recipeId, locals.user.id);
		} catch (err) {
			throw error(403, 'Not allowed to delete this recipe');
		}

		return { success: true };
	}
};
