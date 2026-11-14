import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) redirect(302, '/login');
	return {};
};

function rangeFrom(form: FormData): { start: number; end: number } | undefined {
	const start = Number(form.get('start'));
	const end = Number(form.get('end'));
	if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return undefined;
	return { start, end };
}

export const actions: Actions = {
	/**
	 * Adds the stretch's recipes to the active shopping list and opens it. Kept until the Shop
	 * door takes the list over.
	 */
	addPlanToShopping: async ({ locals, request }) => {
		if (!locals.actor) redirect(302, '/login');
		const range = rangeFrom(await request.formData());
		const recipeIds = await AppFactory.getPlanController().recipeIdsInStretch(
			locals.actor,
			new Date(),
			locals.timeZone,
			range
		);
		const shopping = AppFactory.getShoppingListController();
		const list = await shopping.getActiveList(locals.actor);
		for (const recipeId of recipeIds) {
			await shopping.addRecipeIngredients(locals.actor, list.id, recipeId, false, []);
		}
		redirect(303, '/shopping');
	}
};
