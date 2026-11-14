import type { PlannedMealSlot } from '$lib/models/plan';
import type { TonightSlot } from '$lib/models/tonight';
import { dayNumber, localHour } from '../kitchen/days';

/** Lunch leads until 14:30 when one is planned and not yet eaten. */
export const LUNCH_UNTIL_HOUR = 14.5;
/** Tonight's dinner leads until 21:30; after that Tonight shows tomorrow's dinner. */
export const DINNER_UNTIL_HOUR = 21.5;

export interface TonightTarget<M extends PlannedMealSlot> {
	meal: M | null;
	slot: TonightSlot;
	/** The local day of the target meal. */
	day: number;
	/** The dinner is already cooked. */
	eaten: boolean;
	/** The household is eating out tonight. */
	out: boolean;
	tomorrow: boolean;
}

/**
 * The meal Tonight answers for at `now`: today's lunch before 14:30 when it is planned and not
 * eaten, today's dinner until 21:30, and tomorrow's dinner after that. A skipped meal never
 * counts.
 */
export function tonightTarget<M extends PlannedMealSlot>(
	meals: M[],
	now: Date,
	timeZone: string
): TonightTarget<M> {
	const today = dayNumber(now, timeZone);
	const hour = localHour(now, timeZone);
	const at = (day: number, mealType: PlannedMealSlot['mealType']) =>
		meals.find(
			(meal) =>
				meal.mealType === mealType &&
				meal.status !== 'SKIPPED' &&
				dayNumber(meal.plannedDate, timeZone) === day
		) ?? null;
	const target = (meal: M | null, slot: TonightSlot, day: number, tomorrow = false) => ({
		meal,
		slot,
		day,
		eaten: meal?.status === 'COOKED',
		out: meal?.status === 'EATEN_OUT',
		tomorrow
	});

	if (hour < LUNCH_UNTIL_HOUR) {
		const lunch = at(today, 'LUNCH');
		if (lunch && lunch.status === 'PLANNED') return target(lunch, 'lunch', today);
	}
	if (hour < DINNER_UNTIL_HOUR) return target(at(today, 'DINNER'), 'dinner', today);
	return target(at(today + 1, 'DINNER'), 'dinner', today + 1, true);
}
