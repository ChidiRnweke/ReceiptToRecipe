import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PreferencesController } from '$lib/controllers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const preferencesController = new PreferencesController();
	const preferences = await preferencesController.getPreferences(locals.user.id);

	return {
		preferences
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();

		const allergiesStr = data.get('allergies')?.toString() || '';
		const dietaryRestrictionsStr = data.get('dietaryRestrictions')?.toString() || '';
		const cuisinePreferencesStr = data.get('cuisinePreferences')?.toString() || '';
		const excludedIngredientsStr = data.get('excludedIngredients')?.toString() || '';
		const caloricGoalStr = data.get('caloricGoal')?.toString();
		const defaultServingsStr = data.get('defaultServings')?.toString();

		const allergies = allergiesStr ? allergiesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const dietaryRestrictions = dietaryRestrictionsStr ? dietaryRestrictionsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const cuisinePreferences = cuisinePreferencesStr ? cuisinePreferencesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const excludedIngredients = excludedIngredientsStr ? excludedIngredientsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const caloricGoal = caloricGoalStr ? parseInt(caloricGoalStr) : null;
		const defaultServings = defaultServingsStr ? parseInt(defaultServingsStr) : 2;

		try {
			const preferencesController = new PreferencesController();
			await preferencesController.updatePreferences(locals.user.id, {
				allergies,
				dietaryRestrictions,
				cuisinePreferences,
				excludedIngredients,
				caloricGoal,
				defaultServings
			});

			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to save preferences'
			});
		}
	}
};
