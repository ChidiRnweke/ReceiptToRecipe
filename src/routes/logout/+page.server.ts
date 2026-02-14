import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { deleteSessionCookie } from '$lib/services/AuthService';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.session) {
		const authService = AppFactory.getAuthService();
		await authService.logout(locals.session.id);
		deleteSessionCookie(cookies);
	}

	throw redirect(302, '/');
};
