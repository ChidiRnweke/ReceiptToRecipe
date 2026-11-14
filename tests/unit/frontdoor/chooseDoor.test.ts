import { describe, it, expect } from 'vitest';
import { chooseDoor, type DoorContext } from '../../../src/lib/services/frontdoor';
import type { Habits } from '../../../src/lib/models/kitchen';
import type { PlannedMealSlot } from '../../../src/lib/models/plan';
import { TZ, at } from '../../helpers/kitchenEvents';

// The test calendar's day 0 is Monday 2 November 2026, in UTC.

const NO_HABITS: Habits = {
	shopDays: [],
	planningEvenings: [],
	doneHabitByMember: {},
	prepDay: null,
	planningStyle: 'few',
	usuals: []
};

function dinner(day: number, status: PlannedMealSlot['status'] = 'PLANNED'): PlannedMealSlot {
	return {
		id: `dinner-${day}`,
		recipeId: 'recipe-1',
		plannedDate: at(day, 12),
		mealType: 'DINNER',
		status,
		isPrep: false
	};
}

function prep(day: number, status: PlannedMealSlot['status'] = 'PLANNED'): PlannedMealSlot {
	return {
		id: `prep-${day}`,
		recipeId: 'recipe-2',
		plannedDate: at(day, 12),
		mealType: 'PREP',
		status,
		isPrep: true
	};
}

function context(overrides: Partial<DoorContext> = {}): DoorContext {
	return {
		now: at(0, 17),
		timeZone: TZ,
		habits: NO_HABITS,
		roles: { plans: true, shops: true, cooks: true },
		memberCount: 1,
		tracksKitchen: true,
		lastShopDoneAt: null,
		meals: [],
		...overrides
	};
}

describe('chooseDoor', () => {
	describe('prep day', () => {
		const sunday = { ...NO_HABITS, prepDay: 6 as const };

		it('opens Plan on the prep day morning while the prep is not cooked', () => {
			const ctx = context({ habits: sunday, now: at(6, 10), meals: [prep(6)] });
			expect(chooseDoor(ctx).door).toBe('plan');
		});

		it('leaves the prep day to Tonight from 17:00', () => {
			const ctx = context({ habits: sunday, now: at(6, 17.5), meals: [prep(6)] });
			expect(chooseDoor(ctx).door).toBe('tonight');
		});

		it('leaves the prep day to Tonight once the prep is cooked', () => {
			const ctx = context({ habits: sunday, now: at(6, 10), meals: [prep(6, 'COOKED')] });
			expect(chooseDoor(ctx).door).toBe('tonight');
		});

		it('does not count an ordinary dinner on the prep day as prep', () => {
			const ctx = context({ habits: sunday, now: at(6, 10), meals: [dinner(6)] });
			expect(chooseDoor(ctx).door).toBe('tonight');
		});
	});

	describe('after a shop', () => {
		it('opens Use it up an hour after a shop closed', () => {
			expect(chooseDoor(context({ lastShopDoneAt: at(0, 16) })).door).toBe('use-it-up');
		});

		it('never lands a household that does not track on Use it up', () => {
			const ctx = context({ tracksKitchen: false, lastShopDoneAt: at(0, 16) });
			expect(chooseDoor(ctx).door).toBe('tonight');
		});

		it('stops opening Use it up three hours after the shop', () => {
			expect(chooseDoor(context({ lastShopDoneAt: at(0, 13.5) })).door).toBe('tonight');
		});

		it('waits a few minutes after the shop closes', () => {
			expect(chooseDoor(context({ lastShopDoneAt: at(0, 16.98) })).door).toBe('tonight');
		});
	});

	describe('before a shop', () => {
		const mondayShop = {
			...NO_HABITS,
			shopDays: [{ weekday: 0 as const, hour: 18, confirmed: false }]
		};

		it('opens Shop for the shopper within 90 minutes of the usual shop time', () => {
			expect(chooseDoor(context({ habits: mondayShop })).door).toBe('shop');
		});

		it('keeps a member who does not shop on Tonight', () => {
			const ctx = context({
				habits: mondayShop,
				memberCount: 2,
				roles: { plans: true, shops: false, cooks: true }
			});
			expect(chooseDoor(ctx).door).toBe('tonight');
		});

		it('treats the only member of a household as its shopper', () => {
			const ctx = context({
				habits: mondayShop,
				roles: { plans: true, shops: false, cooks: true }
			});
			expect(chooseDoor(ctx).door).toBe('shop');
		});

		it('does not open Shop two hours before the shop', () => {
			expect(chooseDoor(context({ habits: mondayShop, now: at(0, 16) })).door).toBe('tonight');
		});
	});

	describe('planning evening', () => {
		const mondayPlanning: Habits = {
			...NO_HABITS,
			planningEvenings: [{ weekday: 0, hour: 17 }]
		};
		const mondayAtNine: Habits = {
			...NO_HABITS,
			planningEvenings: [{ weekday: 0, hour: 21 }]
		};

		it('opens Plan on a planning evening with dinners still open', () => {
			expect(chooseDoor(context({ habits: mondayPlanning, now: at(0, 20) })).door).toBe('plan');
		});

		it('stays on Tonight when the coming dinners are all planned', () => {
			const meals = [1, 2, 3, 4].map((day) => dinner(day));
			const ctx = context({ habits: mondayPlanning, now: at(0, 20), meals });
			expect(chooseDoor(ctx).door).toBe('tonight');
		});

		it('waits for the evening on a planning day', () => {
			expect(chooseDoor(context({ habits: mondayPlanning, now: at(0, 12) })).door).toBe('tonight');
		});

		it('waits for the usual planning hour', () => {
			expect(chooseDoor(context({ habits: mondayAtNine, now: at(0, 20) })).door).toBe('tonight');
		});

		it('opens Plan from the usual planning hour', () => {
			expect(chooseDoor(context({ habits: mondayAtNine, now: at(0, 21.25) })).door).toBe('plan');
		});
	});

	it('opens Tonight by default', () => {
		expect(chooseDoor(context()).door).toBe('tonight');
	});

	it('gives a reason with every choice', () => {
		expect(chooseDoor(context()).reason.length).toBeGreaterThan(0);
	});

	it('reads the hour in the household time zone', () => {
		// 16:00 UTC is 17:00 in Brussels, so the 18:00 shop is within the hour there.
		const ctx = context({
			habits: { ...NO_HABITS, shopDays: [{ weekday: 0, hour: 18, confirmed: false }] },
			now: at(0, 16),
			timeZone: 'Europe/Brussels'
		});
		expect(chooseDoor(ctx).door).toBe('shop');
	});
});
