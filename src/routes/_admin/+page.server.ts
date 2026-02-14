import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	// Double check admin (hook handles it, but safety first)
	if (!locals.user || locals.user.role !== 'ADMIN') {
		throw error(403, 'Forbidden');
	}

	const userRepo = AppFactory.getUserRepository();
	const waitingUsers = await userRepo.findWaitingUsers();

	return {
		waitingUsers
	};
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'ADMIN') {
			throw error(403, 'Forbidden');
		}

		const data = await request.formData();
		const userId = data.get('userId') as string;

		if (!userId) {
			return fail(400, { message: 'User ID required' });
		}

		const userRepo = AppFactory.getUserRepository();
		await userRepo.updateRole(userId, 'USER');

		return { success: true };
	}
};
