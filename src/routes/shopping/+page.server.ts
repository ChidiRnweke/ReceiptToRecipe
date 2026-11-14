import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The shopping list moved to the Shop door. */
export const load: PageServerLoad = () => {
	redirect(308, '/shop');
};
