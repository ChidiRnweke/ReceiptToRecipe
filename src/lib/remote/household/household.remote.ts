import { query } from '$app/server';
import { AppFactory } from '$lib/factories';
import type { MemberRoles } from '$lib/models/household';
import { requireActor } from '../actor';

export interface Me {
	displayName: string;
	householdName: string;
	roles: MemberRoles;
	memberCount: number;
}

/** Who is signed in and which household they cook for. */
export const getMe = query(async (): Promise<Me> => {
	const actor = requireActor();
	const { household, members } = await AppFactory.getHouseholdController().getOverview(actor);
	return {
		displayName: actor.displayName,
		householdName: household.name,
		roles: actor.roles,
		memberCount: members.length
	};
});
