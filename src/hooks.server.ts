import type { Handle } from '@sveltejs/kit';
import { AuthService, getSessionCookie } from '$lib/services/AuthService';

const authService = new AuthService();

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = getSessionCookie(event.cookies);

	if (sessionId) {
		const result = await authService.validateSession(sessionId);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		}
	}

	return resolve(event);
};
