import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$factories/AppFactory';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const pantryController = AppFactory.getPantryController();
	const receiptRepo = AppFactory.getReceiptRepository();

	const purchaseHistoryRepo = AppFactory.getPurchaseHistoryRepository();

	// Fetch data promises
	const itemsPromise = pantryController.getUserPantry(locals.user.id);
	const expiredItemsPromise = pantryController.getExpiredItems(locals.user.id);
	const recentReceiptsPromise = receiptRepo.findByUserIdWithItems(locals.user.id, 5);
	const allHistoryPromise = purchaseHistoryRepo.findByUserId(locals.user.id);

	return {
		streamed: {
			items: itemsPromise,
			expiredItems: expiredItemsPromise,
			recentReceipts: recentReceiptsPromise,
			existingItemNames: allHistoryPromise.then((h) => [...new Set(h.map((i) => i.itemName))])
		}
	};
};

export const actions: Actions = {
	addItem: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const itemName = data.get('itemName')?.toString()?.trim();
		const quantity = data.get('quantity')?.toString()?.trim() || null;
		const unit = data.get('unit')?.toString()?.trim() || null;
		const category = data.get('category')?.toString()?.trim() || null;
		const shelfLifeDays = data.get('shelfLifeDays')?.toString()?.trim();
		const parsedShelfLife = shelfLifeDays ? parseInt(shelfLifeDays, 10) : null;

		if (!itemName) {
			return fail(400, { error: 'Item name is required' });
		}

		const pantryController = AppFactory.getPantryController();

		try {
			await pantryController.addManualItem(locals.user.id, {
				itemName,
				quantity,
				unit,
				category,
				shelfLifeDays: parsedShelfLife
			});
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
