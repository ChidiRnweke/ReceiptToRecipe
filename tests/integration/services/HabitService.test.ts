import { describe, it, expect, beforeEach } from 'vitest';
import { HabitService } from '../../../src/lib/services/HabitService';
import { InMemoryKitchenEventRepository } from '../../fakes/InMemoryKitchenEventRepository';
import { InMemoryHabitAnswerRepository } from '../../fakes/InMemoryHabitAnswerRepository';
import { InMemoryPlannedMealRepository } from '../../fakes/InMemoryPlannedMealRepository';
import { InMemoryHouseholdRepository } from '../../fakes/InMemoryHouseholdRepository';
import { MockPurchaseHistoryRepository } from '../../mocks/MockPurchaseHistoryRepository';
import type { Actor } from '../../../src/lib/models/household';

const NOW = new Date('2026-11-15T21:00:00Z');

describe('HabitService', () => {
	let events: InMemoryKitchenEventRepository;
	let service: HabitService;
	let actor: Actor;

	beforeEach(async () => {
		events = new InMemoryKitchenEventRepository();
		const households = new InMemoryHouseholdRepository();
		const member = await households.createSoloHousehold('Sam', {
			userId: 'user-sam',
			displayName: 'Sam'
		});
		actor = {
			userId: member.userId,
			householdId: member.householdId,
			memberId: member.id,
			displayName: member.displayName,
			roles: member.roles
		};
		service = new HabitService(
			events,
			new InMemoryHabitAnswerRepository(),
			new InMemoryPlannedMealRepository(),
			new MockPurchaseHistoryRepository(),
			households
		);
		// Thursday shops on three consecutive weeks, closed by ticking the list.
		for (const date of ['2026-10-29', '2026-11-05', '2026-11-12']) {
			await events.append({
				householdId: actor.householdId,
				actorUserId: actor.userId,
				occurredAt: new Date(`${date}T18:00:00Z`),
				kind: 'SHOP_DONE',
				method: 'TICK'
			});
		}
	});

	it("keys the done habit by the shopper's household member id", async () => {
		const habits = await service.getHabits(actor.householdId, NOW, 'UTC');

		expect(habits.doneHabitByMember).toEqual({ [actor.memberId]: 'TICK' });
	});

	it('stops offering a shop day once the household declined it', async () => {
		await service.answerOffer(actor, 'shopDay:3', 'declined', NOW);

		const habits = await service.getHabits(actor.householdId, NOW, 'UTC');

		expect(habits.shopDays).toEqual([]);
	});
});
