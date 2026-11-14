import type { Habits, ShopDay } from '$lib/models/kitchen';
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

/** Local days of the stretch the household plans next: `start` inclusive, `end` exclusive. */
export interface Stretch {
	start: number;
	end: number;
}

/**
 * The days the next planning session covers. It starts today, or tomorrow from 19:00. A shop
 * within two days moves the start to the shop day. A household that plans a week ahead plans
 * seven days; others plan four, or up to the next shop when they have learned shop days.
 */
export function comingStretch(habits: Habits, now: Date, timeZone: string): Stretch {
	const today = dayNumber(now, timeZone);
	let start = localHour(now, timeZone) >= 19 ? today + 1 : today;
	const shops = upcomingShops(habits.shopDays, now, timeZone).filter((s) => s.hoursAway > -1);
	if (shops[0] && shops[0].day - start <= 2) start = Math.max(start, shops[0].day);
	const week = habits.planningStyle === 'week';
	let end = start + (week ? 7 : 4);
	if (!week) {
		const next = shops.find((s) => s.day > start);
		if (next) end = Math.min(start + 7, next.day);
	}
	return { start, end };
}

/** Days in the stretch without a dinner. */
export function unplannedDinners(
	meals: PlannedMealSlot[],
	stretch: Stretch,
	timeZone: string
): number[] {
	const out: number[] = [];
	for (let day = stretch.start; day < stretch.end; day++) {
		if (!hasDinner(meals, day, timeZone)) out.push(day);
	}
	return out;
}
