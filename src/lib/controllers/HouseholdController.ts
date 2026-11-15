import type {
	HouseholdUser,
	IHouseholdEventService,
	IHouseholdService,
	InvitePreview
} from '$services';
import type {
	Actor,
	Household,
	HouseholdInvite,
	HouseholdMember,
	MemberRoles
} from '$lib/models/household';

export interface HouseholdOverview {
	household: Household;
	members: HouseholdMember[];
}

export class HouseholdController {
	constructor(
		private householdService: IHouseholdService,
		private householdEventService: IHouseholdEventService
	) {}

	async getOverview(actor: Actor): Promise<HouseholdOverview> {
		const [household, members] = await Promise.all([
			this.householdService.getHousehold(actor),
			this.householdService.listMembers(actor)
		]);
		return { household, members };
	}

	async setRoles(actor: Actor, memberId: string, roles: MemberRoles): Promise<HouseholdMember> {
		return this.householdService.setRoles(actor, memberId, roles);
	}

	async setTimeZone(actor: Actor, timeZone: string): Promise<Household> {
		return this.householdService.setTimeZone(actor, timeZone);
	}

	async createInvite(actor: Actor): Promise<HouseholdInvite> {
		return this.householdService.createInvite(actor);
	}

	async previewInvite(token: string): Promise<InvitePreview> {
		return this.householdService.previewInvite(token);
	}

	/** Joins the invite's household; the members already there hear about it in "Needs you". */
	async acceptInvite(user: HouseholdUser, token: string, now: Date = new Date()): Promise<void> {
		const before = await this.householdService.resolveActor(user);
		await this.householdService.acceptInvite(user, token);
		const after = await this.householdService.resolveActor(user);
		if (after.householdId !== before.householdId) {
			await this.householdEventService.recordJoined(after, now);
		}
	}
}
