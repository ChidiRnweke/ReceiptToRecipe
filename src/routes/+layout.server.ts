import type { LayoutServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:session');

	if (!locals.user || !locals.actor) {
		return {
			user: null,
			workflowCounts: null
		};
	}

	const actor = locals.actor;

	// Fetch counts for the workflow nav using repositories
	const receiptRepo = AppFactory.getReceiptRepository();
	const recipeRepo = AppFactory.getRecipeRepository();
	const pantryController = AppFactory.getPantryController();

	const [receiptCount, recipeCount, cupboardCount] = await Promise.all([
		receiptRepo.countByHouseholdId(actor.householdId),
		recipeRepo.countByHouseholdId(actor.householdId),
		pantryController.getCupboardCount(actor)
	]);

	const listController = AppFactory.getShoppingListController();
	let shoppingItems = 0;
	try {
		const activeList = await listController.getActiveList(actor);
		shoppingItems = activeList.items?.filter((i) => !i.checked).length || 0;
	} catch {
		// No active list
	}

	return {
		user: locals.user,
		workflowCounts: {
			receipts: receiptCount,
			cupboardItems: cupboardCount,
			recipes: recipeCount,
			shoppingItems
		}
	};
};
