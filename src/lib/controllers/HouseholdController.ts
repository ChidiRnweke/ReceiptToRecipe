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

/** What the invite page shows before a member joins another household. */
export interface JoinPreview {
	status: InvitePreview['status'];
	householdName: string | null;
	alreadyMember: boolean;
	/**
	 * First names of the others in the member's current household. Empty when the member is on
	 * their own, and then their kitchen comes with them; otherwise it stays with these members.
	 */
	staysWith: string[];
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

	/** The invite as `actor` sees it: whether they are in it already and who keeps their kitchen. */
	async previewJoin(actor: Actor, token: string): Promise<JoinPreview> {
		const [preview, members] = await Promise.all([
			this.householdService.previewInvite(token),
			this.householdService.listMembers(actor)
		]);
		return {
			status: preview.status,
			householdName: preview.household?.name ?? null,
			alreadyMember: preview.household?.id === actor.householdId,
			staysWith: members
				.filter((member) => member.userId !== actor.userId)
				.map((member) => member.displayName.trim().split(/\s+/)[0])
		};
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
