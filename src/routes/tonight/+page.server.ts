import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) redirect(302, '/login');
	const { householdId } = locals.actor;
	// The first-visit welcome shows to a household with no receipts and no recipes yet.
	const [receipts, recipes] = await Promise.all([
		AppFactory.getReceiptRepository().countByHouseholdId(householdId),
		AppFactory.getRecipeRepository().countByHouseholdId(householdId)
	]);
	return { receipts, recipes };
};
