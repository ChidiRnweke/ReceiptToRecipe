import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The cupboard became the Use it up door. */
export const load: PageServerLoad = () => {
	redirect(308, '/use-it-up');
};
