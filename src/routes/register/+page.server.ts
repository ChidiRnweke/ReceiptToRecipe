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
		const name = data.get('name')?.toString();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();

		if (!name || !email || !password) {
			return fail(400, { error: 'All fields are required', name, email });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', name, email });
		}

		try {
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
