import { v4 as uuid } from 'uuid';
import type { IHouseholdRepository } from '../../src/lib/repositories/interfaces/IHouseholdRepository';
import type {
	Household,
	HouseholdInvite,
	HouseholdMember,
	MemberRoles,
	NewHousehold,
	NewHouseholdInvite,
	NewHouseholdMember
} from '../../src/lib/models/household';

/**
 * In-memory household store. Shared kitchen rows are represented by a simple
 * `rowsByHousehold` count so tests can observe that data moves with a joining member.
 */
export class InMemoryHouseholdRepository implements IHouseholdRepository {
	private households = new Map<string, Household>();
	private members = new Map<string, HouseholdMember>();
	private invites = new Map<string, HouseholdInvite>();
	private sharedRows = new Map<string, number>();

	async createHousehold(household: NewHousehold): Promise<Household> {
		const now = new Date();
		const created: Household = { id: uuid(), name: household.name, createdAt: now, updatedAt: now };
		this.households.set(created.id, created);
		return created;
	}

	async findHouseholdById(id: string): Promise<Household | null> {
		return this.households.get(id) ?? null;
	}

	async findMemberByUserId(userId: string): Promise<HouseholdMember | null> {
		return [...this.members.values()].find((member) => member.userId === userId) ?? null;
	}

	async findMemberById(id: string): Promise<HouseholdMember | null> {
		return this.members.get(id) ?? null;
	}

	async listMembers(householdId: string): Promise<HouseholdMember[]> {
		return [...this.members.values()].filter((member) => member.householdId === householdId);
	}

	async createSoloHousehold(
		name: string,
		member: Omit<NewHouseholdMember, 'householdId'>
	): Promise<HouseholdMember> {
		const existing = await this.findMemberByUserId(member.userId);
		if (existing) return existing;
		const household = await this.createHousehold({ name });
		return this.createMember({ ...member, householdId: household.id });
	}

	async createMember(member: NewHouseholdMember): Promise<HouseholdMember> {
		if (await this.findMemberByUserId(member.userId)) {
			throw new Error('duplicate key value violates unique constraint');
		}
		const created: HouseholdMember = {
			id: uuid(),
			householdId: member.householdId,
			userId: member.userId,
			displayName: member.displayName,
			color: member.color ?? null,
			roles: {
				plans: member.roles?.plans ?? true,
				shops: member.roles?.shops ?? true,
				cooks: member.roles?.cooks ?? true
			},
			joinedAt: new Date()
		};
		this.members.set(created.id, created);
		return created;
	}

	async updateMemberRoles(memberId: string, roles: MemberRoles): Promise<HouseholdMember> {
		const member = this.members.get(memberId);
		if (!member) throw new Error('Member not found');
		const updated = { ...member, roles: { ...roles } };
		this.members.set(memberId, updated);
		return updated;
	}

	async createInvite(invite: NewHouseholdInvite): Promise<HouseholdInvite> {
		const created: HouseholdInvite = {
			id: uuid(),
			householdId: invite.householdId,
			token: invite.token,
			createdBy: invite.createdBy,
			expiresAt: invite.expiresAt,
			usedAt: null,
			usedBy: null,
			createdAt: new Date()
		};
		this.invites.set(created.id, created);
		return created;
	}

	async findInviteByToken(token: string): Promise<HouseholdInvite | null> {
		return [...this.invites.values()].find((invite) => invite.token === token) ?? null;
	}

	async markInviteUsed(inviteId: string, usedBy: string, usedAt: Date): Promise<HouseholdInvite> {
		const invite = this.invites.get(inviteId);
		if (!invite) throw new Error('Invite not found');
		const updated = { ...invite, usedBy, usedAt };
		this.invites.set(inviteId, updated);
		return updated;
	}

	async moveMemberWithData(
		userId: string,
		fromHouseholdId: string,
		toHouseholdId: string
	): Promise<void> {
		const member = await this.findMemberByUserId(userId);
		if (!member) throw new Error('Member not found');
		this.members.set(member.id, { ...member, householdId: toHouseholdId, joinedAt: new Date() });

		if ((await this.listMembers(fromHouseholdId)).length > 0) return;

		const moved = this.sharedRows.get(fromHouseholdId) ?? 0;
		this.sharedRows.set(toHouseholdId, (this.sharedRows.get(toHouseholdId) ?? 0) + moved);
		this.sharedRows.delete(fromHouseholdId);
		this.households.delete(fromHouseholdId);
	}

	// Test helpers

	/** Seeds a household-scoped row (a receipt, a cupboard item, …) for the household. */
	addSharedRow(householdId: string): void {
		this.sharedRows.set(householdId, (this.sharedRows.get(householdId) ?? 0) + 1);
	}

	sharedRowCount(householdId: string): number {
		return this.sharedRows.get(householdId) ?? 0;
	}

	householdCount(): number {
		return this.households.size;
	}

	/** Stores an invite as-is, so tests can seed expired or used invites. */
	seedInvite(invite: HouseholdInvite): void {
		this.invites.set(invite.id, invite);
	}
}
