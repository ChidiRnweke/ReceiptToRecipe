import type { PlanGap, PlannedMealSlot, PlanRange, PlanSlotType } from '$lib/models/plan';
import { dayNumber } from '../kitchen/days';

/** True when the slot holds a meal that was not skipped. */
export function slotTaken(
	meals: PlannedMealSlot[],
	day: number,
	mealType: PlanSlotType,
	timeZone: string
): boolean {
	return meals.some(
		(meal) =>
			meal.mealType === mealType &&
			meal.status !== 'SKIPPED' &&
			dayNumber(meal.plannedDate, timeZone) === day
	);
}

/** The slots in the range with nothing planned, day by day and in the order of `slots`. */
export function findGaps(
	meals: PlannedMealSlot[],
	range: PlanRange,
	slots: PlanSlotType[],
	timeZone: string
): PlanGap[] {
	const gaps: PlanGap[] = [];
	for (let day = range.start; day < range.end; day++) {
		for (const mealType of slots) {
			if (!slotTaken(meals, day, mealType, timeZone)) gaps.push({ day, mealType });
		}
	}
	return gaps;
}

/** A meal whose pot can feed the next day. */
export interface LeftoverSource {
	id: string;
	recipeId: string | null;
	mealName: string;
	plannedDate: Date;
}

/** The planned lunch a leftover makes: the next day, from the same recipe, linked to the meal. */
export interface LeftoverLunch {
	day: number;
	mealType: 'LUNCH';
	recipeId: string | null;
	mealName: string;
	leftoverOfId: string;
}

/** Cooking for two days puts the next day's lunch in the plan, from the same pot. */
export function planLeftoverLunch(meal: LeftoverSource, timeZone: string): LeftoverLunch {
	return {
		day: dayNumber(meal.plannedDate, timeZone) + 1,
		mealType: 'LUNCH',
		recipeId: meal.recipeId,
		mealName: meal.mealName,
		leftoverOfId: meal.id
	};
}
