import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AuthService, setSessionCookie } from '$lib/services/AuthService';

const authService = new AuthService();

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required', email });
		}

		try {
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
