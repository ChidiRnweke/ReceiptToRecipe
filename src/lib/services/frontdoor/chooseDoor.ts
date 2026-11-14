import type { Habits } from '$lib/models/kitchen';
import type { MemberRoles } from '$lib/models/household';
import type { PlannedMealSlot } from '$lib/models/plan';
import type { DoorChoice } from '$lib/models/tonight';
import { dayNumber, localHour, weekdayOfDay } from '../kitchen/days';
import { EVENING_FROM_HOUR } from '../habits/learnHabits';
import { comingStretch, unplannedDinners, upcomingShops } from '../plan/days';

/** Plan opens for the prep between these local hours on the prep day. */
export const PREP_FROM_HOUR = 8;
export const PREP_UNTIL_HOUR = 17;
/** Use it up opens this long after a shop closes: not the same minute, and not hours later. */
export const AFTER_SHOP_MIN_HOURS = 0.1;
export const AFTER_SHOP_MAX_HOURS = 3;
/** Shop opens this long before the learned shop time. */
export const BEFORE_SHOP_HOURS = 1.5;

export interface DoorContext {
	now: Date;
	timeZone: string;
	habits: Habits;
	/** Roles of the member who opens the app. */
	roles: MemberRoles;
	memberCount: number;
	/** The household records purchases (has BOUGHT events). */
	tracksKitchen: boolean;
	lastShopDoneAt: Date | null;
	/** Planned meals from today over the next week or so. */
	meals: PlannedMealSlot[];
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * The door that fits the moment, checked in this order: the prep day before 17:00 with meals
 * still to cook opens Plan; a shop that closed in the last three hours opens Use it up for a
 * household that tracks its kitchen; the shopper's learned shop time within 90 minutes opens
 * Shop; a learned planning evening with dinners still open opens Plan; anything else opens
 * Tonight. The household has no prep flag on meals yet, so on the prep day every meal planned
 * for today that is not cooked counts as prep.
 */
export function chooseDoor(ctx: DoorContext): DoorChoice {
	const { now, timeZone, habits } = ctx;
	const today = dayNumber(now, timeZone);
	const weekday = weekdayOfDay(today);
	const hour = localHour(now, timeZone);

	const prepLeft = ctx.meals.some(
		(meal) => meal.status === 'PLANNED' && dayNumber(meal.plannedDate, timeZone) === today
	);
	if (habits.prepDay === weekday && prepLeft && hour >= PREP_FROM_HOUR && hour < PREP_UNTIL_HOUR) {
		return { door: 'plan', reason: 'It is the usual prep day and nothing is cooked yet.' };
	}

	if (ctx.tracksKitchen && ctx.lastShopDoneAt) {
		const since = (now.getTime() - ctx.lastShopDoneAt.getTime()) / HOUR_MS;
		if (since >= AFTER_SHOP_MIN_HOURS && since <= AFTER_SHOP_MAX_HOURS) {
			return {
				door: 'use-it-up',
				reason: 'A shop just finished, so the fridge is at its fullest.'
			};
		}
	}

	const shopper = ctx.roles.shops || ctx.memberCount === 1;
	const nextShop = upcomingShops(habits.shopDays, now, timeZone).find((s) => s.hoursAway > 0);
	const shopSoon = nextShop !== undefined && nextShop.hoursAway <= BEFORE_SHOP_HOURS;
	if (shopper && shopSoon) {
		return { door: 'shop', reason: 'The household usually shops around now.' };
	}

	if (habits.planningEvenings.includes(weekday) && hour >= EVENING_FROM_HOUR) {
		const open = unplannedDinners(ctx.meals, comingStretch(habits, now, timeZone), timeZone);
		if (open.length > 0) {
			return { door: 'plan', reason: 'This is a usual planning evening and dinners are open.' };
		}
	}

	if (shopSoon) {
		return {
			door: 'tonight',
			reason: 'Someone else does the shop, so this member stays on Tonight.'
		};
	}
	return { door: 'tonight', reason: 'The default: the next meal.' };
}
