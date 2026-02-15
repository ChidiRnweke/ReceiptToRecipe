import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$factories/AppFactory';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const pantryController = AppFactory.getPantryController();

	const [items, expiredItems, stats] = await Promise.all([
		pantryController.getUserPantry(locals.user.id),
		pantryController.getExpiredItems(locals.user.id),
		pantryController.getCupboardStats(locals.user.id)
	]);

	// Extract unique categories for filter dropdown
	const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];

	// Get all item names from purchase history for autocomplete
	const purchaseHistoryRepo = AppFactory.getPurchaseHistoryRepository();
	const allHistory = await purchaseHistoryRepo.findByUserId(locals.user.id);
	const existingItemNames = [...new Set(allHistory.map((h) => h.itemName))];

	return {
		items,
		expiredItems,
		stats,
		categories,
		existingItemNames
	};
};

export const actions: Actions = {
	addItem: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemName = data.get('itemName')?.toString()?.trim();

		if (!itemName) {
			return fail(400, { error: 'Item name is required' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.addManualItem(locals.user.id, { itemName });
			return { success: true };
		} catch (err) {
			console.error('Failed to add cupboard item:', err);
			return fail(500, { error: 'Failed to add item' });
		}
	},

	markUsedUp: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const source = data.get('source')?.toString() as 'receipt' | 'manual';

		if (!itemId || !source) {
			return fail(400, { error: 'Missing item ID or source' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.markItemUsedUp(itemId, source);
			return { success: true };
		} catch (err) {
			console.error('Failed to mark item as used:', err);
			return fail(500, { error: 'Failed to update item' });
		}
	},

	confirmInStock: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const source = data.get('source')?.toString() as 'receipt' | 'manual';

		if (!itemId || !source) {
			return fail(400, { error: 'Missing item ID or source' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.confirmItemInStock(itemId, source);
			return { success: true };
		} catch (err) {
			console.error('Failed to confirm item in stock:', err);
			return fail(500, { error: 'Failed to update item' });
		}
	},

	updateItem: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const source = data.get('source')?.toString() as 'receipt' | 'manual';
		const quantity = data.get('quantity')?.toString() || null;
		const category = data.get('category')?.toString() || null;
		const shelfLifeDaysRaw = data.get('shelfLifeDays')?.toString();
		const shelfLifeDays = shelfLifeDaysRaw ? parseInt(shelfLifeDaysRaw) : null;

		if (!itemId || !source) {
			return fail(400, { error: 'Missing item ID or source' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.updateItem(itemId, source, {
				quantity,
				category,
				shelfLifeDays
			});
			return { success: true };
		} catch (err) {
			console.error('Failed to update item:', err);
			return fail(500, { error: 'Failed to update item' });
		}
	},

	deleteItem: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();

		if (!itemId) {
			return fail(400, { error: 'Missing item ID' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.deleteManualItem(itemId);
			return { success: true };
		} catch (err) {
			console.error('Failed to delete item:', err);
			return fail(500, { error: 'Failed to delete item' });
		}
	},

	addToShoppingList: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemName = data.get('itemName')?.toString()?.trim();
		const quantity = data.get('quantity')?.toString() || null;
		const unit = data.get('unit')?.toString() || null;

		if (!itemName) {
			return fail(400, { error: 'Missing item name' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.addToShoppingList(locals.user.id, itemName, quantity, unit);
			return { success: true, addedToList: itemName };
		} catch (err) {
			console.error('Failed to add to shopping list:', err);
			return fail(500, { error: 'Failed to add to shopping list' });
		}
	}
};
