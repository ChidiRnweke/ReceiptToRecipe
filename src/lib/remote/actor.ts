import { getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import type { Actor } from '$lib/models/household';

/** The signed-in actor for the current remote-function call; a 401 when nobody is signed in. */
export function requireActor(): Actor {
	const { locals } = getRequestEvent();
	if (!locals.actor) error(401, 'Sign in required');
	return locals.actor;
}
