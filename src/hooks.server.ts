import type { Handle } from '@sveltejs/kit';
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

	return resolve(event);
};
