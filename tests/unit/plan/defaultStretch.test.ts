import { describe, it, expect } from 'vitest';
import { defaultStretch, pickedStretch } from '../../../src/lib/services/plan';
import type { Habits } from '../../../src/lib/models/kitchen';
import { DAY0, TZ, at } from '../../helpers/kitchenEvents';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC.

const HABITS: Habits = {
	shopDays: [],
	planningEvenings: [],
	doneHabitByMember: {},
	prepDay: null,
	planningStyle: 'few',
	usuals: []
};
/** Shops on Tuesday and Saturday mornings. */
const TUESDAY_AND_SATURDAY: Habits = {
	...HABITS,
	shopDays: [
		{ weekday: 1, hour: 10, confirmed: false },
		{ weekday: 5, hour: 10, confirmed: false }
	]
};

describe('defaultStretch', () => {
	it('starts at a learned shop within two days', () => {
		expect(defaultStretch(TUESDAY_AND_SATURDAY, at(0, 12), TZ).start).toBe(DAY0 + 1);
	});

	it('runs until the following learned shop', () => {
		expect(defaultStretch(TUESDAY_AND_SATURDAY, at(0, 12), TZ).end).toBe(DAY0 + 5);
	});

	it('says it runs until the shop', () => {
		expect(defaultStretch(TUESDAY_AND_SATURDAY, at(0, 12), TZ).reason).toBe('until-shop');
	});

	it('plans seven days for a household that plans the week', () => {
		const week = { ...TUESDAY_AND_SATURDAY, planningStyle: 'week' as const };
		const stretch = defaultStretch(week, at(0, 12), TZ);
		expect(stretch.end - stretch.start).toBe(7);
	});

	it('plans the next four days without learned shops', () => {
		expect(defaultStretch(HABITS, at(0, 12), TZ)).toEqual({
			start: DAY0,
			end: DAY0 + 4,
			reason: 'few'
		});
	});

	it('starts tomorrow from 19:00', () => {
		expect(defaultStretch(HABITS, at(0, 19.5), TZ).start).toBe(DAY0 + 1);
	});

	it('starts today before 19:00', () => {
		expect(defaultStretch(HABITS, at(0, 18.5), TZ).start).toBe(DAY0);
	});
});

describe('pickedStretch', () => {
	it('caps a picked range at ten days', () => {
		const stretch = pickedStretch({ start: DAY0, end: DAY0 + 14 }, DAY0);
		expect(stretch.end).toBe(DAY0 + 10);
	});

	it('moves a range that starts in the past to today', () => {
		expect(pickedStretch({ start: DAY0 - 2, end: DAY0 + 3 }, DAY0).start).toBe(DAY0);
	});
});
