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
		const name = requireString(data.get('name')?.toString(), 'Name is required');
		const email = requireString(data.get('email')?.toString(), 'Email is required');
		const password = requireString(data.get('password')?.toString(), 'Password is required');

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', name, email });
		}

		try {
			const authService = AppFactory.getAuthService();
			const user = await authService.createUser(email, password, name);
			const session = await authService.createSession(user.id);
			setSessionCookie(cookies, session.id);
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Registration failed',
				name,
				email
			});
		}

		throw redirect(302, '/');
	}
};
