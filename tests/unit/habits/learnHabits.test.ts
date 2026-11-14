import { describe, it, expect } from 'vitest';
import { applyHabitAnswers, learnHabits, type HabitInput } from '../../../src/lib/services/habits';
import type { ShopMethod } from '../../../src/lib/models/kitchen';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sunday 15 November 2026, 21:00 UTC. The Monday of this week is 9 November. */
const NOW = new Date('2026-11-15T21:00:00Z');
const THIS_MONDAY = new Date('2026-11-09T00:00:00Z');

/** A moment on `weekday` (0 = Monday) of the week `weeksAgo` weeks back, at `hour` UTC. */
function on(weekday: number, weeksAgo: number, hour = 12): Date {
	return new Date(
		THIS_MONDAY.getTime() + (weekday - weeksAgo * 7) * DAY_MS + hour * 60 * 60 * 1000
	);
}

function input(overrides: Partial<HabitInput>): HabitInput {
	return {
		now: NOW,
		timeZone: 'UTC',
		shops: [],
		plannedMeals: [],
		cooked: [],
		bought: [],
		purchaseCounts: [],
		...overrides
	};
}

/** Shops on the given weekdays, one per occasion, the last one in the current week. */
function shopsOn(weekdays: number[], method: ShopMethod = 'RECEIPT', memberId = 'sam') {
	return weekdays.map((weekday, index) => ({
		occurredAt: on(weekday, Math.floor((weekdays.length - 1 - index) / 2), 17),
		memberId,
		method
	}));
}

describe('learnHabits', () => {
	describe('shop days', () => {
		it('learns Monday and Thursday from a household that shops on those days', () => {
			const habits = learnHabits(input({ shops: shopsOn([3, 0, 3, 0, 3, 0]) }));

			expect(habits.shopDays.map((day) => day.weekday)).toEqual([0, 3]);
		});

		it('learns no shop day from a household that shops on a different day each time', () => {
			const habits = learnHabits(
				input({
					shops: [0, 2, 4, 1, 3].map((weekday, index) => ({
						occurredAt: on(weekday, 4 - index),
						memberId: 'lea',
						method: 'RECEIPT' as const
					}))
				})
			);

			expect(habits.shopDays).toEqual([]);
		});

		it('takes the usual hour in the household time zone', () => {
			const habits = learnHabits(
				input({ timeZone: 'Europe/Brussels', shops: shopsOn([3, 0, 3, 0]) })
			);

			expect(habits.shopDays[0].hour).toBe(18);
		});

		it('ignores shops older than eight weeks', () => {
			const habits = learnHabits(
				input({
					shops: [9, 10].map((weeksAgo) => ({
						occurredAt: on(4, weeksAgo),
						memberId: 'sam',
						method: 'RECEIPT' as const
					}))
				})
			);

			expect(habits.shopDays).toEqual([]);
		});
	});

	describe('done habit', () => {
		it("takes each member's most common way of closing a shop", () => {
			const shops = [
				...shopsOn([0, 3], 'TICK', 'marc'),
				{ occurredAt: on(5, 0), memberId: 'marc', method: 'RECEIPT' as const }
			];

			expect(learnHabits(input({ shops })).doneHabitByMember).toEqual({ marc: 'TICK' });
		});
	});

	describe('planning evenings', () => {
		it('learns a weekday on which the household planned after 17:00 twice', () => {
			const plannedMeals = [1, 2].map((weeksAgo) => ({
				createdAt: on(2, weeksAgo, 20),
				plannedDate: on(4, weeksAgo, 19)
			}));

			expect(learnHabits(input({ plannedMeals })).planningEvenings).toEqual([2]);
		});

		it('does not count daytime planning', () => {
			const plannedMeals = [1, 2].map((weeksAgo) => ({
				createdAt: on(2, weeksAgo, 10),
				plannedDate: on(4, weeksAgo, 19)
			}));

			expect(learnHabits(input({ plannedMeals })).planningEvenings).toEqual([]);
		});
	});

	describe('prep day', () => {
		it('learns the weekday on which the household batch-cooks', () => {
			const cooked = [1, 2].map((weeksAgo) => ({ occurredAt: on(6, weeksAgo, 11), portions: 4 }));

			expect(learnHabits(input({ cooked })).prepDay).toBe(6);
		});

		it('does not count cooking that puts aside fewer than three portions', () => {
			const cooked = [1, 2].map((weeksAgo) => ({ occurredAt: on(6, weeksAgo, 11), portions: 1 }));

			expect(learnHabits(input({ cooked })).prepDay).toBeNull();
		});
	});

	describe('planning style', () => {
		function planningReach(days: number) {
			return [1, 2, 3].map((weeksAgo) => ({
				createdAt: on(0, weeksAgo, 20),
				plannedDate: on(days, weeksAgo, 19)
			}));
		}

		it('is none for a household that never plans', () => {
			expect(learnHabits(input({})).planningStyle).toBe('none');
		});

		it('is few for a household that plans two days ahead', () => {
			expect(learnHabits(input({ plannedMeals: planningReach(2) })).planningStyle).toBe('few');
		});

		it('is week for a household that plans six days ahead', () => {
			expect(learnHabits(input({ plannedMeals: planningReach(6) })).planningStyle).toBe('week');
		});

		it('is prep for a household with a prep day', () => {
			const cooked = [1, 2].map((weeksAgo) => ({ occurredAt: on(6, weeksAgo, 11), portions: 4 }));

			expect(learnHabits(input({ cooked, plannedMeals: planningReach(6) })).planningStyle).toBe(
				'prep'
			);
		});
	});

	describe('usuals', () => {
		it('learns an item bought on three separate shops', () => {
			const bought = [0, 1, 2].map((weeksAgo) => ({
				itemKey: 'milk',
				occurredAt: on(3, weeksAgo)
			}));

			expect(learnHabits(input({ bought })).usuals).toEqual(['milk']);
		});

		it('does not learn an item bought twice', () => {
			const bought = [0, 1].map((weeksAgo) => ({ itemKey: 'milk', occurredAt: on(3, weeksAgo) }));

			expect(learnHabits(input({ bought })).usuals).toEqual([]);
		});

		it('learns an item the purchase history counts three purchases of', () => {
			const habits = learnHabits(
				input({ purchaseCounts: [{ itemKey: 'yogurt', purchaseCount: 3 }] })
			);

			expect(habits.usuals).toEqual(['yogurt']);
		});
	});
});

describe('applyHabitAnswers', () => {
	it('drops a shop day the household declined', () => {
		const habits = learnHabits(input({ shops: shopsOn([3, 0, 3, 0, 3, 0]) }));
		const answered = applyHabitAnswers(habits, [
			{
				householdId: 'h',
				key: 'shopDay:3',
				answer: 'declined',
				answeredBy: null,
				answeredAt: NOW
			}
		]);

		expect(answered.shopDays.map((day) => day.weekday)).toEqual([0]);
	});
});
