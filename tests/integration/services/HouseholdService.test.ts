import { describe, it, expect, beforeEach } from 'vitest';
import { HouseholdService } from '../../../src/lib/services/HouseholdService';
import { HouseholdInviteError } from '../../../src/lib/models/household';
import { InMemoryHouseholdRepository } from '../../fakes/InMemoryHouseholdRepository';

const NOW = new Date('2026-03-01T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const ada = { id: 'user-ada', name: 'Ada Lovelace' };
const grace = { id: 'user-grace', name: 'Grace Hopper' };

describe('HouseholdService', () => {
	let repo: InMemoryHouseholdRepository;
	let service: HouseholdService;

	beforeEach(() => {
		repo = new InMemoryHouseholdRepository();
		service = new HouseholdService(repo, () => NOW);
	});

	async function seedInvite(overrides: { expiresAt?: Date; usedAt?: Date | null } = {}) {
		const inviter = await service.resolveActor(ada);
		repo.seedInvite({
			id: 'invite-1',
			householdId: inviter.householdId,
			token: 'token-1',
			createdBy: ada.id,
			expiresAt: overrides.expiresAt ?? new Date(NOW.getTime() + DAY_MS),
			usedAt: overrides.usedAt ?? null,
			usedBy: overrides.usedAt ? 'user-someone' : null,
			createdAt: NOW
		});
		return inviter;
	}

	describe('resolving the actor', () => {
		it('creates a household for a user who has none', async () => {
			const actor = await service.resolveActor(ada);

			expect(await repo.findHouseholdById(actor.householdId)).not.toBeNull();
		});

		it("names a new household after the user's kitchen", async () => {
			const actor = await service.resolveActor(ada);

			expect((await repo.findHouseholdById(actor.householdId))?.name).toBe(
				"Ada Lovelace's kitchen"
			);
		});

		it("uses the user's first name as the member display name", async () => {
			const actor = await service.resolveActor(ada);

			expect(actor.displayName).toBe('Ada');
		});

		it('returns the existing membership on later requests', async () => {
			const first = await service.resolveActor(ada);
			const second = await service.resolveActor(ada);

			expect(second.householdId).toBe(first.householdId);
		});
	});

	describe('creating an invite', () => {
		it('expires the invite seven days after it is created', async () => {
			const actor = await service.resolveActor(ada);

			const invite = await service.createInvite(actor);

			expect(invite.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
		});

		it("previews the inviting household's name", async () => {
			const actor = await service.resolveActor(ada);
			const invite = await service.createInvite(actor);

			const preview = await service.previewInvite(invite.token);

			expect(preview.household?.name).toBe("Ada Lovelace's kitchen");
		});
	});

	describe('accepting an invite', () => {
		it('rejects an unknown token', async () => {
			await expect(service.acceptInvite(grace, 'no-such-token')).rejects.toBeInstanceOf(
				HouseholdInviteError
			);
		});

		it('rejects an expired token', async () => {
			await seedInvite({ expiresAt: new Date(NOW.getTime() - 1) });

			await expect(service.acceptInvite(grace, 'token-1')).rejects.toMatchObject({
				reason: 'expired'
			});
		});

		it('rejects an already-used token', async () => {
			await seedInvite({ usedAt: new Date(NOW.getTime() - DAY_MS) });

			await expect(service.acceptInvite(grace, 'token-1')).rejects.toMatchObject({
				reason: 'used'
			});
		});

		it("moves the joining member into the inviter's household", async () => {
			const inviter = await seedInvite();

			await service.acceptInvite(grace, 'token-1');

			expect((await service.resolveActor(grace)).householdId).toBe(inviter.householdId);
		});

		it("brings the joining member's kitchen data along", async () => {
			const inviter = await seedInvite();
			const joiner = await service.resolveActor(grace);
			repo.addSharedRow(joiner.householdId);

			await service.acceptInvite(grace, 'token-1');

			expect(repo.sharedRowCount(inviter.householdId)).toBe(1);
		});

		it("deletes the joining member's emptied household", async () => {
			await seedInvite();
			const joiner = await service.resolveActor(grace);

			await service.acceptInvite(grace, 'token-1');

			expect(await repo.findHouseholdById(joiner.householdId)).toBeNull();
		});

		it('marks the invite as used', async () => {
			await seedInvite();

			await service.acceptInvite(grace, 'token-1');

			expect((await repo.findInviteByToken('token-1'))?.usedBy).toBe(grace.id);
		});

		it('leaves the household unchanged when joining your own household', async () => {
			const inviter = await seedInvite();

			await service.acceptInvite(ada, 'token-1');

			expect((await service.resolveActor(ada)).householdId).toBe(inviter.householdId);
		});

		it('keeps the invite usable when joining your own household', async () => {
			await seedInvite();

			await service.acceptInvite(ada, 'token-1');

			expect((await repo.findInviteByToken('token-1'))?.usedAt).toBeNull();
		});
	});

	describe('setting roles', () => {
		it("updates a household member's roles", async () => {
			const actor = await service.resolveActor(ada);

			const updated = await service.setRoles(actor, actor.memberId, {
				plans: false,
				shops: true,
				cooks: true
			});

			expect(updated.roles.plans).toBe(false);
		});

		it('rejects a member of another household', async () => {
			const actor = await service.resolveActor(ada);
			const stranger = await service.resolveActor(grace);

			await expect(
				service.setRoles(actor, stranger.memberId, { plans: false, shops: false, cooks: false })
			).rejects.toThrow('Member not found');
		});
	});

	describe('time zone', () => {
		it('gives a new household the Brussels time zone', async () => {
			const actor = await service.resolveActor(ada);

			expect(actor.timeZone).toBe('Europe/Brussels');
		});

		it("puts the household's stored time zone on the actor", async () => {
			const actor = await service.resolveActor(ada);
			await service.setTimeZone(actor, 'America/New_York');

			expect((await service.resolveActor(ada)).timeZone).toBe('America/New_York');
		});

		it('shares the time zone with every member of the household', async () => {
			const inviter = await seedInvite();
			await service.setTimeZone(inviter, 'Asia/Tokyo');
			await service.acceptInvite(grace, 'token-1');

			expect((await service.resolveActor(grace)).timeZone).toBe('Asia/Tokyo');
		});

		it('rejects a time zone the runtime does not know', async () => {
			const actor = await service.resolveActor(ada);

			await expect(service.setTimeZone(actor, 'Mars/Olympus_Mons')).rejects.toThrow(
				'Unknown time zone'
			);
		});

		it('keeps the stored time zone after a rejected change', async () => {
			const actor = await service.resolveActor(ada);
			await service.setTimeZone(actor, 'Mars/Olympus_Mons').catch(() => undefined);

			expect((await service.resolveActor(ada)).timeZone).toBe('Europe/Brussels');
		});
	});
});
