import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) {
		throw redirect(302, '/login');
	}

	const receiptController = AppFactory.getReceiptController();

	// Stream receipts and recipe counts - page renders immediately with skeleton
	const receiptsPromise = receiptController.getHouseholdReceipts(locals.actor);

	const recipeCountsPromise = receiptsPromise.then((receipts) => {
		const receiptIds = receipts.map((r) => r.id);
		if (receiptIds.length === 0) return {};
		return AppFactory.getRecipeRepository()
			.countByReceiptIds(receiptIds)
			.then((counts) => Object.fromEntries(counts.map((c) => [c.receiptId, c.count])));
	});

	return {
		// Stream both receipts and recipe counts
		streamed: {
			receipts: receiptsPromise,
			recipeCounts: recipeCountsPromise
		}
	};
};

export const actions: Actions = {
	addToShopping: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const receiptId = data.get('receiptId')?.toString();

		if (!receiptId) {
			return fail(400, { error: 'Receipt ID is required' });
		}

		try {
			const listController = AppFactory.getShoppingListController();
			const list = await listController.getActiveList(locals.actor);
			await listController.addReceiptItems(locals.actor, list.id, receiptId);
			return { success: true, listId: list.id };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add items'
			});
		}
	},

	delete: async ({ locals, request }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const receiptId = data.get('id')?.toString();

		if (!receiptId) {
			return fail(400, { error: 'Receipt ID is required' });
		}

		try {
			const receiptController = AppFactory.getReceiptController();
			await receiptController.deleteReceipt(receiptId, locals.actor);
			return { success: true };
		} catch (err) {
			console.error('Delete error:', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to delete receipt'
			});
		}
	}
};
