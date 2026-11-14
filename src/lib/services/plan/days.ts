import type { ShopDay } from '$lib/models/kitchen';
import type { PlannedMealSlot } from '$lib/models/plan';
import { dayNumber, localHour, weekdayOfDay } from '../kitchen/days';

export interface UpcomingShop {
	day: number;
	/** Hours from now until the learned shop time; negative when it was earlier today. */
	hoursAway: number;
}

/** The learned shop times from today over the next `horizonDays` days, soonest first. */
export function upcomingShops(
	shopDays: ShopDay[],
	now: Date,
	timeZone: string,
	horizonDays = 14
): UpcomingShop[] {
	const today = dayNumber(now, timeZone);
	const hour = localHour(now, timeZone);
	const out: UpcomingShop[] = [];
	for (let day = today; day < today + horizonDays; day++) {
		for (const shop of shopDays) {
			if (shop.weekday === weekdayOfDay(day)) {
				out.push({ day, hoursAway: (day - today) * 24 + shop.hour - hour });
			}
		}
	}
	return out.sort((a, b) => a.hoursAway - b.hoursAway);
}

/** True when the day has a dinner that was not skipped. */
export function hasDinner(meals: PlannedMealSlot[], day: number, timeZone: string): boolean {
	return meals.some(
		(meal) =>
			meal.mealType === 'DINNER' &&
			meal.status !== 'SKIPPED' &&
			dayNumber(meal.plannedDate, timeZone) === day
	);
}

/** The first day in `from`…`to` (inclusive) without a dinner, or null. */
export function nextFreeDinnerDay(
	meals: PlannedMealSlot[],
	from: number,
	to: number,
	timeZone: string
): number | null {
	for (let day = from; day <= to; day++) {
		if (!hasDinner(meals, day, timeZone)) return day;
	}
	return null;
}
