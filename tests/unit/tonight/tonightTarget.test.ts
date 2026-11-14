import { describe, it, expect } from 'vitest';
import { tonightTarget } from '../../../src/lib/services/tonight';
import type { MealType, PlannedMealSlot } from '../../../src/lib/models/plan';
import { TZ, at } from '../../helpers/kitchenEvents';

function meal(
	id: string,
	day: number,
	mealType: MealType,
	status: PlannedMealSlot['status'] = 'PLANNED'
): PlannedMealSlot {
	return { id, recipeId: 'recipe-1', plannedDate: at(day, 12), mealType, status, isPrep: false };
}

describe('tonightTarget', () => {
	const lunch = meal('lunch', 0, 'LUNCH');
	const dinner = meal('dinner', 0, 'DINNER');
	const tomorrow = meal('tomorrow', 1, 'DINNER');

	it('leads with a planned lunch before 14:30', () => {
		expect(tonightTarget([lunch, dinner], at(0, 11), TZ).meal?.id).toBe('lunch');
	});

	it('moves on to dinner from 14:30', () => {
		expect(tonightTarget([lunch, dinner], at(0, 14.5), TZ).meal?.id).toBe('dinner');
	});

	it('skips a lunch that is already eaten', () => {
		const eaten = meal('lunch', 0, 'LUNCH', 'COOKED');
		expect(tonightTarget([eaten, dinner], at(0, 11), TZ).meal?.id).toBe('dinner');
	});

	it('shows tonight’s dinner until 21:30', () => {
		expect(tonightTarget([dinner, tomorrow], at(0, 21.4), TZ).meal?.id).toBe('dinner');
	});

	it('marks a cooked dinner as eaten', () => {
		const cooked = meal('dinner', 0, 'DINNER', 'COOKED');
		expect(tonightTarget([cooked], at(0, 20), TZ).eaten).toBe(true);
	});

	it('marks a dinner eaten out', () => {
		const out = meal('dinner', 0, 'DINNER', 'EATEN_OUT');
		expect(tonightTarget([out], at(0, 19), TZ).out).toBe(true);
	});

	it('shows tomorrow’s dinner after 21:30', () => {
		expect(tonightTarget([dinner, tomorrow], at(0, 22), TZ).meal?.id).toBe('tomorrow');
	});

	it('says the meal is tomorrow’s after 21:30', () => {
		expect(tonightTarget([dinner, tomorrow], at(0, 22), TZ).tomorrow).toBe(true);
	});

	it('ignores a skipped dinner', () => {
		const skipped = meal('dinner', 0, 'DINNER', 'SKIPPED');
		expect(tonightTarget([skipped], at(0, 19), TZ).meal).toBeNull();
	});

	it('reads the day in the household time zone', () => {
		// 23:30 UTC on day 0 is 08:30 on day 1 in Tokyo, so day 1's lunch leads.
		const nextLunch = meal('next-lunch', 1, 'LUNCH');
		expect(tonightTarget([nextLunch], at(0, 23.5), 'Asia/Tokyo').meal?.id).toBe('next-lunch');
	});
});
