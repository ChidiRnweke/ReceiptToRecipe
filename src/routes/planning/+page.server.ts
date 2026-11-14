import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The Plan door moved to /plan. */
export const load: PageServerLoad = () => {
	redirect(308, '/plan');
};
