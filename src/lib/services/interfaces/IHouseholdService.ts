import type {
	Actor,
	Household,
	HouseholdInvite,
	HouseholdMember,
	MemberRoles
} from '$lib/models/household';

/** The parts of a signed-in user the household service needs. */
export interface HouseholdUser {
	id: string;
	name: string;
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'not_found';

export interface InvitePreview {
	status: InviteStatus;
	household: Household | null;
}

export interface IHouseholdService {
	resolveActor(user: HouseholdUser): Promise<Actor>;
	getHousehold(actor: Actor): Promise<Household>;
	listMembers(actor: Actor): Promise<HouseholdMember[]>;
	setRoles(actor: Actor, memberId: string, roles: MemberRoles): Promise<HouseholdMember>;
	createInvite(actor: Actor): Promise<HouseholdInvite>;
	previewInvite(token: string): Promise<InvitePreview>;
	acceptInvite(user: HouseholdUser, token: string): Promise<void>;
}
