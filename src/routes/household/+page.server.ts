import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) throw redirect(302, '/login');

	const overview = await AppFactory.getHouseholdController().getOverview(locals.actor);

	return {
		household: overview.household,
		members: overview.members,
		currentMemberId: locals.actor.memberId
	};
};

export const actions: Actions = {
	setRoles: async ({ locals, request }) => {
		if (!locals.actor) throw redirect(302, '/login');

		const data = await request.formData();
		const memberId = data.get('memberId')?.toString();
		if (!memberId) return fail(400, { error: 'Member is required' });

		try {
			await AppFactory.getHouseholdController().setRoles(locals.actor, memberId, {
				plans: data.get('plans') === 'true',
				shops: data.get('shops') === 'true',
				cooks: data.get('cooks') === 'true'
			});
			return { success: true };
		} catch (err) {
			return fail(404, { error: err instanceof Error ? err.message : 'Unable to update roles' });
		}
	},

	invite: async ({ locals, url }) => {
		if (!locals.actor) throw redirect(302, '/login');

		const invite = await AppFactory.getHouseholdController().createInvite(locals.actor);
		return {
			inviteUrl: `${url.origin}/household/join/${invite.token}`,
			expiresAt: invite.expiresAt.toISOString()
		};
	}
};
