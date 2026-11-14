import { redirect, type Handle } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import { getSessionCookie } from '$lib/services/AuthService';
import { ConfigService } from '$lib/services/ConfigService';

// Initialize configuration service (fetches secrets)
// Top-level await is supported in Node 22
await ConfigService.getInstance().init();

/** Used until the browser has reported its time zone. */
const DEFAULT_TIME_ZONE = 'Europe/Brussels';

/** The browser's IANA time zone from the `tz` cookie, when it names a real zone. */
function timeZoneFrom(value: string | undefined): string {
	if (!value) return DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat('en', { timeZone: value });
		return value;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.timeZone = timeZoneFrom(event.cookies.get('tz'));
	const sessionId = getSessionCookie(event.cookies);

	if (sessionId) {
		const authService = AppFactory.getAuthService();
		const result = await authService.validateSession(sessionId);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			event.locals.actor = await AppFactory.getHouseholdService().resolveActor(result.user);
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
