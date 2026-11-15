import { describe, it, expect, beforeEach } from 'vitest';
import { HouseholdController } from '../../../src/lib/controllers/HouseholdController';
import { HouseholdService } from '../../../src/lib/services/HouseholdService';
import { HouseholdEventService } from '../../../src/lib/services/HouseholdEventService';
import type { Actor } from '../../../src/lib/models/household';
import { InMemoryHouseholdRepository } from '../../fakes/InMemoryHouseholdRepository';
import { InMemoryHouseholdEventRepository } from '../../fakes/InMemoryHouseholdEventRepository';

const NOW = new Date('2026-11-14T12:00:00Z');
const noorUser = { id: 'user-1', name: 'Noor Haddad' };
const graceUser = { id: 'user-2', name: 'Grace Hopper' };

describe('HouseholdController', () => {
	let households: InMemoryHouseholdRepository;
	let service: HouseholdService;
	let controller: HouseholdController;
	let noor: Actor;
	let grace: Actor;
	let token: string;

	beforeEach(async () => {
		households = new InMemoryHouseholdRepository();
		service = new HouseholdService(households, () => NOW);
		controller = new HouseholdController(
			service,
			new HouseholdEventService(new InMemoryHouseholdEventRepository())
		);
		noor = await service.resolveActor(noorUser);
		grace = await service.resolveActor(graceUser);
		token = (await controller.createInvite(noor)).token;
	});

	describe('the invite page before joining', () => {
		it('brings the kitchen of a member who is on their own', async () => {
			expect((await controller.previewJoin(grace, token)).staysWith).toEqual([]);
		});

		it('leaves the kitchen with the members who stay behind', async () => {
			await households.createMember({
				householdId: grace.householdId,
				userId: 'user-3',
				displayName: 'Linus Berg'
			});
			expect((await controller.previewJoin(grace, token)).staysWith).toEqual(['Linus']);
		});

		it('names the household to join', async () => {
			expect((await controller.previewJoin(grace, token)).householdName).toBe(
				"Noor Haddad's kitchen"
			);
		});

		it('tells a member of the household that they are in it already', async () => {
			expect((await controller.previewJoin(noor, token)).alreadyMember).toBe(true);
		});
	});
});
