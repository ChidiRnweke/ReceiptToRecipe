import type { Habits } from '$lib/models/kitchen';
import { MAX_STRETCH_DAYS, STRIP_DAYS, type PlanRange, type PlanStretch } from '$lib/models/plan';
import { dayNumber, localHour } from '../kitchen/days';
import { upcomingShops } from './days';

/** From this local hour, today's dinner is settled and the stretch starts tomorrow. */
export const TOMORROW_FROM_HOUR = 19;
/** A learned shop this many days after the start moves the start to the shop day. */
export const SHOP_START_WITHIN_DAYS = 2;
/** Days a household that plans a week ahead plans in one go. */
export const WEEK_DAYS = 7;
/** Days everyone else plans when no learned shop ends the stretch. */
export const FEW_DAYS = 4;

/**
 * The days the Plan door offers to plan: `start` inclusive, `end` exclusive. It starts today,
 * or tomorrow from 19:00. A learned shop within two days moves the start to the shop day, so
 * the plan runs from one shop to the next. A household that plans a week ahead plans seven
 * days. Others plan until the following learned shop, or four days when no shop is learned.
 * No stretch is longer than ten days.
 */
export function defaultStretch(habits: Habits, now: Date, timeZone: string): PlanStretch {
	const today = dayNumber(now, timeZone);
	let start = localHour(now, timeZone) >= TOMORROW_FROM_HOUR ? today + 1 : today;
	const shops = upcomingShops(habits.shopDays, now, timeZone).filter((s) => s.hoursAway > -1);
	if (shops[0] && shops[0].day - start <= SHOP_START_WITHIN_DAYS) {
		start = Math.max(start, shops[0].day);
	}
	const cap = (end: number) => Math.min(end, start + MAX_STRETCH_DAYS);

	if (habits.planningStyle === 'week')
		return { start, end: cap(start + WEEK_DAYS), reason: 'week' };
	const next = shops.find((s) => s.day > start);
	if (next) return { start, end: cap(next.day), reason: 'until-shop' };
	return { start, end: cap(start + FEW_DAYS), reason: 'few' };
}

/**
 * A range the member picked, kept inside the day strip: it starts no earlier than today and
 * within the strip, and runs one to ten days.
 */
export function pickedStretch(range: PlanRange, today: number): PlanStretch {
	const lastStart = today + STRIP_DAYS - 1;
	const start = Math.min(Math.max(range.start, today), lastStart);
	const end = Math.min(Math.max(range.end, start + 1), start + MAX_STRETCH_DAYS);
	return { start, end, reason: 'custom' };
}
