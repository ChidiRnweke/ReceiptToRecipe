import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setSessionCookie } from '$lib/services/AuthService';
import { AppFactory } from '$lib/factories';
import { requireString } from '$lib/validation';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = requireString(data.get('email')?.toString(), 'Email is required');
		const password = requireString(data.get('password')?.toString(), 'Password is required');

		try {
			const authService = AppFactory.getAuthService();
			const result = await authService.login(email, password);
			setSessionCookie(cookies, result.session.id);
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Login failed',
				email
			});
		}

		throw redirect(302, '/');
	}
};
