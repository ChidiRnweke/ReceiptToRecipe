import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';
import { HouseholdInviteError } from '$lib/models/household';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Login always lands on `/`, so a signed-out invitee opens the link again after signing in.
	if (!locals.user || !locals.actor) throw redirect(302, '/login');

	const preview = await AppFactory.getHouseholdController().previewInvite(params.token);

	return {
		status: preview.status,
		householdName: preview.household?.name ?? null,
		alreadyMember: preview.household?.id === locals.actor.householdId
	};
};

export const actions: Actions = {
	default: async ({ locals, params }) => {
		if (!locals.user) throw redirect(302, '/login');

		try {
			await AppFactory.getHouseholdController().acceptInvite(locals.user, params.token);
		} catch (err) {
			if (err instanceof HouseholdInviteError) {
				return fail(400, { error: err.message });
			}
			throw err;
		}

		throw redirect(303, '/');
	}
};
