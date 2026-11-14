import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageLoad } from './$types';

/** A review sheet for the shared door components; it exists only in development. */
export const load: PageLoad = () => {
	if (!dev) error(404, 'Not found');
};
