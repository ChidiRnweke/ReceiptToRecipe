import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { AuthService, deleteSessionCookie } from '$lib/services/AuthService';

const authService = new AuthService();

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.session) {
		await authService.logout(locals.session.id);
		deleteSessionCookie(cookies);
	}

	throw redirect(302, '/');
};
