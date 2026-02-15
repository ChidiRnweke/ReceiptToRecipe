import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const receiptController = AppFactory.getReceiptController();
	const receipt = await receiptController.getReceipt(params.id, locals.user.id);

	if (!receipt) {
		throw error(404, 'Receipt not found');
	}

	// Stream generated recipes - not critical for initial render
	const generatedRecipesPromise = AppFactory.getRecipeRepository().findByReceiptId(params.id);

	return {
		receipt,
		streamed: {
			generatedRecipes: generatedRecipesPromise
		}
	};
};

export const actions: Actions = {
	addToShopping: async ({ locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			await listController.addReceiptItems(locals.user.id, list.id, params.id);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add items'
			});
		}
	},

	addSingleItemToShopping: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const form = await request.formData();
		const name = form.get('name')?.toString();
		const quantityStr = form.get('quantity')?.toString();
		const unit = form.get('unit')?.toString();

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		const quantity = quantityStr && quantityStr.trim() !== '' ? quantityStr : undefined;

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			await listController.addItem(locals.user.id, list.id, {
				name,
				quantity,
				unit: unit || undefined
			});
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add item'
			});
		}
	},

	updateItem: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const form = await request.formData();
		const itemId = form.get('itemId')?.toString();
		const name = form.get('name')?.toString();
		const quantity = form.get('quantity')?.toString();
		const unit = form.get('unit')?.toString();
		const price = form.get('price')?.toString();
		const category = form.get('category')?.toString();

		if (!itemId || !name || !quantity) {
			return fail(400, { error: 'Item, name, and quantity are required' });
		}

		try {
			const receiptController = AppFactory.getReceiptController();
			await receiptController.updateReceiptItem(params.id, locals.user.id, itemId, {
				name,
				quantity,
				unit,
				price,
				category
			});
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to update item'
			});
		}
	},

	addItem: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const form = await request.formData();
		const name = form.get('name')?.toString();
		const quantity = form.get('quantity')?.toString();
		const unit = form.get('unit')?.toString();
		const price = form.get('price')?.toString();
		const category = form.get('category')?.toString();

		if (!name || !quantity) {
			return fail(400, { error: 'Name and quantity are required' });
		}

		try {
			const receiptController = AppFactory.getReceiptController();
			await receiptController.addManualItem(params.id, locals.user.id, {
				name,
				quantity,
				unit,
				price,
				category
			});
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to add item'
			});
		}
	},

	deleteItem: async ({ locals, params, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const form = await request.formData();
		const itemId = form.get('itemId')?.toString();
		if (!itemId) return fail(400, { error: 'Item is required' });

		try {
			const receiptController = AppFactory.getReceiptController();
			await receiptController.deleteReceiptItem(params.id, locals.user.id, itemId);
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to delete item'
			});
		}
	}
};
