import { describe, it, expect } from 'vitest';
import { findGaps, planLeftoverLunch } from '../../../src/lib/services/plan';
import type { MealType, PlannedMealSlot } from '../../../src/lib/models/plan';
import type { PlannedMealStatus } from '../../../src/lib/models/kitchen';
import { DAY0, TZ, at } from '../../helpers/kitchenEvents';

function meal(
	day: number,
	mealType: MealType,
	status: PlannedMealStatus = 'PLANNED'
): PlannedMealSlot {
	return {
		id: `${mealType}-${day}`,
		recipeId: 'recipe-1',
		plannedDate: at(day, 12),
		mealType,
		status,
		isPrep: mealType === 'PREP'
	};
}

const range = { start: DAY0, end: DAY0 + 3 };

describe('findGaps', () => {
	it('lists the days without a dinner', () => {
		const gaps = findGaps([meal(1, 'DINNER')], range, ['DINNER'], TZ);
		expect(gaps.map((gap) => gap.day)).toEqual([DAY0, DAY0 + 2]);
	});

	it('counts a skipped dinner as open', () => {
		const gaps = findGaps([meal(0, 'DINNER', 'SKIPPED')], range, ['DINNER'], TZ);
		expect(gaps.map((gap) => gap.day)).toEqual([DAY0, DAY0 + 1, DAY0 + 2]);
	});

	it('leaves out the range end', () => {
		const gaps = findGaps([], { start: DAY0, end: DAY0 + 1 }, ['DINNER'], TZ);
		expect(gaps).toHaveLength(1);
	});

	it('finds lunch gaps for a household that plans lunches', () => {
		const meals = [meal(0, 'DINNER'), meal(0, 'LUNCH'), meal(1, 'DINNER'), meal(2, 'DINNER')];
		const gaps = findGaps(meals, range, ['LUNCH', 'DINNER'], TZ);
		expect(gaps).toEqual([
			{ day: DAY0 + 1, mealType: 'LUNCH' },
			{ day: DAY0 + 2, mealType: 'LUNCH' }
		]);
	});

	it('does not let a prep session fill a dinner', () => {
		const gaps = findGaps([meal(0, 'PREP')], { start: DAY0, end: DAY0 + 1 }, ['DINNER'], TZ);
		expect(gaps).toHaveLength(1);
	});
});

describe('planLeftoverLunch', () => {
	const dinner = { id: 'curry', recipeId: 'r-curry', mealName: 'Curry', plannedDate: at(2, 12) };

	it('plans the lunch for the next day', () => {
		expect(planLeftoverLunch(dinner, TZ).day).toBe(DAY0 + 3);
	});

	it('links the lunch to the meal it comes from', () => {
		expect(planLeftoverLunch(dinner, TZ).leftoverOfId).toBe('curry');
	});

	it('makes it a lunch of the same recipe', () => {
		const lunch = planLeftoverLunch(dinner, TZ);
		expect([lunch.mealType, lunch.recipeId]).toEqual(['LUNCH', 'r-curry']);
	});
});
