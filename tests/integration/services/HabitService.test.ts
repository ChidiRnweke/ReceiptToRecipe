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
			roles: member.roles,
			timeZone: 'UTC'
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

	it("counts the usual hour in the household's time zone when the caller passes none", async () => {
		const habits = await service.getHabits(actor.householdId, NOW);

		// 18:00 UTC is 19:00 in Brussels, the time zone a new household starts with.
		expect(habits.shopDays[0]?.hour).toBe(19);
	});

	it('keeps an accepted shop day through a missed week', async () => {
		await service.answerOffer(actor, 'shopDay:3', 'accepted', NOW);

		// Five weeks later, only the 12 November Thursday is still in the eight-week window.
		const later = new Date('2026-12-31T21:00:00Z');
		const habits = await service.getHabits(actor.householdId, later, 'UTC');

		expect(habits.shopDays).toEqual([{ weekday: 3, hour: 18, confirmed: true }]);
	});

	it('drops an accepted shop day once the household declines it', async () => {
		await service.answerOffer(actor, 'shopDay:3', 'accepted', NOW);
		await service.answerOffer(actor, 'shopDay:3', 'declined', NOW);

		const habits = await service.getHabits(actor.householdId, NOW, 'UTC');

		expect(habits.shopDays).toEqual([]);
	});
});
