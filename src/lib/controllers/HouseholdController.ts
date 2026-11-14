import type { HouseholdUser, IHouseholdService, InvitePreview } from '$services';
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
	constructor(private householdService: IHouseholdService) {}

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

	async createInvite(actor: Actor): Promise<HouseholdInvite> {
		return this.householdService.createInvite(actor);
	}

	async previewInvite(token: string): Promise<InvitePreview> {
		return this.householdService.previewInvite(token);
	}

	async acceptInvite(user: HouseholdUser, token: string): Promise<void> {
		return this.householdService.acceptInvite(user, token);
	}
}
