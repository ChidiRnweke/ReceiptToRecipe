import type {
	Household,
	HouseholdInvite,
	HouseholdMember,
	MemberRoles,
	NewHousehold,
	NewHouseholdInvite,
	NewHouseholdMember
} from '$lib/models/household';

export interface IHouseholdRepository {
	createHousehold(household: NewHousehold): Promise<Household>;
	findHouseholdById(id: string): Promise<Household | null>;
	findMemberByUserId(userId: string): Promise<HouseholdMember | null>;
	findMemberById(id: string): Promise<HouseholdMember | null>;
	listMembers(householdId: string): Promise<HouseholdMember[]>;
	createMember(member: NewHouseholdMember): Promise<HouseholdMember>;
	/** Creates a household of one; returns the existing membership if one appeared concurrently. */
	createSoloHousehold(
		name: string,
		member: Omit<NewHouseholdMember, 'householdId'>
	): Promise<HouseholdMember>;
	updateMemberRoles(memberId: string, roles: MemberRoles): Promise<HouseholdMember>;
	updateTimeZone(householdId: string, timeZone: string): Promise<Household>;
	createInvite(invite: NewHouseholdInvite): Promise<HouseholdInvite>;
	findInviteByToken(token: string): Promise<HouseholdInvite | null>;
	markInviteUsed(inviteId: string, usedBy: string, usedAt: Date): Promise<HouseholdInvite>;
	/**
	 * Re-points the user's membership to `toHouseholdId` in one transaction. When that leaves
	 * `fromHouseholdId` without members, its shared rows move to `toHouseholdId` and the empty
	 * household is deleted; otherwise the shared rows stay with the remaining members.
	 */
	moveMemberWithData(userId: string, fromHouseholdId: string, toHouseholdId: string): Promise<void>;
}
