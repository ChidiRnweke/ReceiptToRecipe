import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const receiptController = AppFactory.getReceiptController();
	const receipts = await receiptController.getUserReceipts(locals.user.id);

	// Stream recipe counts - not critical for initial render
	const receiptIds = receipts.map((r) => r.id);
	const recipeCountsPromise =
		receiptIds.length > 0
			? AppFactory.getRecipeRepository()
					.countByReceiptIds(receiptIds)
					.then((counts) => Object.fromEntries(counts.map((c) => [c.receiptId, c.count])))
			: Promise.resolve({});

	return {
		receipts,
		streamed: {
			recipeCounts: recipeCountsPromise
		}
	};
};

export const actions: Actions = {
	addToShopping: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const receiptId = data.get('receiptId')?.toString();

		if (!receiptId) {
			return fail(400, { error: 'Receipt ID is required' });
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.user.id);
			await listController.addReceiptItems(locals.user.id, list.id, receiptId);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add items'
			});
		}
	},

	delete: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const receiptId = data.get('id')?.toString();

		if (!receiptId) {
			return fail(400, { error: 'Receipt ID is required' });
		}

		try {
			const receiptController = AppFactory.getReceiptController();
			await receiptController.deleteReceipt(receiptId, locals.user.id);
			return { success: true };
		} catch (err) {
			console.error('Delete error:', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to delete receipt'
			});
		}
	}
};
