import type { IHouseholdRepository } from '$repositories';
import {
	DEFAULT_TIME_ZONE,
	HouseholdInviteError,
	INVITE_LIFETIME_DAYS,
	isValidTimeZone,
	type Actor,
	type Household,
	type HouseholdInvite,
	type HouseholdMember,
	type MemberRoles
} from '$lib/models/household';
import type {
	HouseholdUser,
	IHouseholdService,
	InvitePreview,
	InviteStatus
} from './interfaces/IHouseholdService';

const DAY_MS = 24 * 60 * 60 * 1000;

export class HouseholdService implements IHouseholdService {
	constructor(
		private householdRepository: IHouseholdRepository,
		private now: () => Date = () => new Date()
	) {}

	/**
	 * Finds the user's membership. A user without one (signed up after households existed)
	 * gets a household of one.
	 */
	async resolveActor(user: HouseholdUser): Promise<Actor> {
		const member =
			(await this.householdRepository.findMemberByUserId(user.id)) ??
			(await this.householdRepository.createSoloHousehold(`${user.name}'s kitchen`, {
				userId: user.id,
				displayName: firstName(user.name)
			}));
		const household = await this.householdRepository.findHouseholdById(member.householdId);
		return this.toActor(member, household?.timeZone ?? DEFAULT_TIME_ZONE);
	}

	async getHousehold(actor: Actor): Promise<Household> {
		const household = await this.householdRepository.findHouseholdById(actor.householdId);
		if (!household) throw new Error('Household not found');
		return household;
	}

	async listMembers(actor: Actor): Promise<HouseholdMember[]> {
		return this.householdRepository.listMembers(actor.householdId);
	}

	async setRoles(actor: Actor, memberId: string, roles: MemberRoles): Promise<HouseholdMember> {
		const member = await this.householdRepository.findMemberById(memberId);
		if (!member || member.householdId !== actor.householdId) {
			throw new Error('Member not found');
		}
		return this.householdRepository.updateMemberRoles(memberId, roles);
	}

	async setTimeZone(actor: Actor, timeZone: string): Promise<Household> {
		const zone = timeZone.trim();
		if (!isValidTimeZone(zone)) throw new Error(`Unknown time zone: ${timeZone}`);
		return this.householdRepository.updateTimeZone(actor.householdId, zone);
	}

	async createInvite(actor: Actor): Promise<HouseholdInvite> {
		return this.householdRepository.createInvite({
			householdId: actor.householdId,
			token: crypto.randomUUID(),
			createdBy: actor.userId,
			expiresAt: new Date(this.now().getTime() + INVITE_LIFETIME_DAYS * DAY_MS)
		});
	}

	async previewInvite(token: string): Promise<InvitePreview> {
		const invite = await this.householdRepository.findInviteByToken(token);
		const status = this.statusOf(invite);
		if (!invite || status !== 'valid') return { status, household: null };

		const household = await this.householdRepository.findHouseholdById(invite.householdId);
		return household ? { status, household } : { status: 'not_found', household: null };
	}

	async acceptInvite(user: HouseholdUser, token: string): Promise<void> {
		const invite = await this.householdRepository.findInviteByToken(token);
		const status = this.statusOf(invite);
		if (!invite || status === 'not_found') {
			throw new HouseholdInviteError('not_found', 'This invite link is not valid');
		}
		if (status === 'used') {
			throw new HouseholdInviteError('used', 'This invite link has already been used');
		}
		if (status === 'expired') {
			throw new HouseholdInviteError('expired', 'This invite link has expired');
		}

		const actor = await this.resolveActor(user);
		if (actor.householdId === invite.householdId) return;

		await this.householdRepository.moveMemberWithData(
			user.id,
			actor.householdId,
			invite.householdId
		);
		await this.householdRepository.markInviteUsed(invite.id, user.id, this.now());
	}

	private statusOf(invite: HouseholdInvite | null): InviteStatus {
		if (!invite) return 'not_found';
		if (invite.usedAt) return 'used';
		if (invite.expiresAt.getTime() <= this.now().getTime()) return 'expired';
		return 'valid';
	}

	private toActor(member: HouseholdMember, timeZone: string): Actor {
		return {
			userId: member.userId,
			householdId: member.householdId,
			memberId: member.id,
			displayName: member.displayName,
			roles: { ...member.roles },
			timeZone
		};
	}
}

function firstName(name: string): string {
	return name.trim().split(/\s+/)[0] || name;
}
