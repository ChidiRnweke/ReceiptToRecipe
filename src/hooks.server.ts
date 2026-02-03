import { redirect, type Handle } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import { getSessionCookie } from '$lib/services/AuthService';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = getSessionCookie(event.cookies);

	if (sessionId) {
		const authService = AppFactory.getAuthService();
		const result = await authService.validateSession(sessionId);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		}
	}

	const user = event.locals.user;
	const path = event.url.pathname;

	// Protected Routes Logic
	if (user) {
		// 1. Role: WAITING
		if (user.role === 'WAITING') {
			const allowedPaths = ['/waiting', '/logout'];
			if (!allowedPaths.includes(path)) {
				throw redirect(303, '/waiting');
			}
		}

		// 2. Redirect out of /waiting if approved
		if (user.role !== 'WAITING' && path === '/waiting') {
			throw redirect(303, '/');
		}

		// 3. Role: ADMIN
		if (path.startsWith('/_admin')) {
			if (user.role !== 'ADMIN') {
				throw redirect(303, '/');
			}
		}
	}

	return resolve(event);
};
