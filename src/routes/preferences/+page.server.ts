import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import { parseNumber, parseStringList } from '$lib/validation';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const preferencesController = AppFactory.getPreferencesController();
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

		const allergies = parseStringList(data.get('allergies')?.toString(), {
			maxItems: 20,
			maxLength: 48
		});
		const dietaryRestrictions = parseStringList(data.get('dietaryRestrictions')?.toString(), {
			maxItems: 20,
			maxLength: 48
		});
		const cuisinePreferences = parseStringList(data.get('cuisinePreferences')?.toString(), {
			maxItems: 20,
			maxLength: 48
		});
		const excludedIngredients = parseStringList(data.get('excludedIngredients')?.toString(), {
			maxItems: 20,
			maxLength: 48
		});
		const caloricGoalValue = parseNumber(data.get('caloricGoal')?.toString(), {
			min: 500,
			max: 10000,
			fallback: null
		});
		const caloricGoal = caloricGoalValue === null ? null : caloricGoalValue;
		const defaultServings =
			parseNumber(data.get('defaultServings')?.toString(), {
				min: 1,
				max: 20,
				fallback: 2
			}) ?? 2;

		try {
			const preferencesController = AppFactory.getPreferencesController();
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
