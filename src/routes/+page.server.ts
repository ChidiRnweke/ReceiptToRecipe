import type { PageServerLoad, Actions } from './$types';
import { AppFactory } from '$lib/factories';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.actor) {
		return { user: null };
	}

	const actor = locals.actor;
	const dashboardService = AppFactory.getDashboardService();

	// Stream non-critical data - don't await, return promises
	const dashboardDataPromise = dashboardService.getDashboardData(actor);

	return {
		user: locals.user,
		// Return the promise directly for streaming
		streamed: {
			dashboardData: dashboardDataPromise
		}
	};
};

export const actions: Actions = {
	toggleIngredient: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const ingredientName = data.get('ingredientName')?.toString();

		if (!ingredientName) {
			return fail(400, { error: 'Ingredient name is required' });
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.actor);

			// Check if item exists
			const existingItem = list.items.find((i) => i.name === ingredientName);

			if (existingItem) {
				await listController.removeItem(locals.actor, existingItem.id);
				return { success: true, removed: ingredientName };
			} else {
				await listController.addItem(locals.actor, list.id, {
					name: ingredientName,
					quantity: '1',
					unit: ''
				});
				return { success: true, added: ingredientName };
			}
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update list'
			});
		}
	}
};
