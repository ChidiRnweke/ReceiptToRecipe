import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ReceiptController } from '$lib/controllers';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const receiptController = new ReceiptController(
		AppFactory.getStorageService(),
		AppFactory.getOcrService(),
		AppFactory.getNormalizationService()
	);

	const receipt = await receiptController.getReceipt(params.id, locals.user.id);

	if (!receipt) {
		throw error(404, 'Receipt not found');
	}

	return {
		receipt
	};
};
