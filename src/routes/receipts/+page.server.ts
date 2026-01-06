import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ReceiptController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const receiptController = new ReceiptController(
		AppFactory.getStorageService(),
		AppFactory.getOcrService(),
		AppFactory.getNormalizationService()
	);

	const receipts = await receiptController.getUserReceipts(locals.user.id);

	return {
		receipts
	};
};
