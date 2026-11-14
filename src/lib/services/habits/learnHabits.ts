import type {
	HabitAnswer,
	Habits,
	PlanningEvening,
	PlanningStyle,
	ShopDay,
	ShopMethod,
	Weekday
} from '$lib/models/kitchen';
import { dayNumber, localHour, weekdayOfDay } from '../kitchen/days';
import { normalizeItemKey } from '../kitchen/itemKey';

/** Habits are learned from the last eight weeks. */
export const HABIT_WINDOW_DAYS = 56;
/** A weekday becomes a habit once it happened on this many separate occasions. */
export const HABIT_MIN_OCCURRENCES = 2;
/** Planning counts as an evening from this local hour. */
export const EVENING_FROM_HOUR = 17;
/** A cooking session that puts aside this many portions counts as batch prep. */
export const PREP_MIN_PORTIONS = 3;
/** An item bought on this many separate shops is a usual. */
export const USUAL_MIN_SHOPS = 3;
/** Hour given to a confirmed shop day that has no shop in the window to take the hour from. */
export const DEFAULT_SHOP_HOUR = 10;
/** Hour given to an accepted planning evening that has no plans in the window to take it from. */
export const DEFAULT_PLANNING_HOUR = EVENING_FROM_HOUR;

export interface HabitInput {
	now: Date;
	timeZone: string;
	/** SHOP_DONE events, attributed to the household member who closed the shop. */
	shops: { occurredAt: Date; memberId: string | null; method: ShopMethod }[];
	/** Planned meals, with when they were planned and for when. */
	plannedMeals: { createdAt: Date; plannedDate: Date }[];
	/** COOKED events with the portions they put aside. */
	cooked: { occurredAt: Date; portions: number | null }[];
	/** BOUGHT events. */
	bought: { itemKey: string; occurredAt: Date }[];
	/** Purchase counts kept by the purchase history, which reaches further back than events. */
	purchaseCounts: { itemKey: string; purchaseCount: number }[];
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return groups;
}

/** Weekdays that occur on at least `min` separate local days, in weekday order. */
function frequentWeekdays(days: number[], min = HABIT_MIN_OCCURRENCES): Weekday[] {
	const distinct = [...new Set(days)];
	const counts = groupBy(distinct, weekdayOfDay);
	return [...counts.entries()]
		.filter(([, occurrences]) => occurrences.length >= min)
		.map(([weekday]) => weekday)
		.sort((a, b) => a - b);
}

function windowFilter(input: HabitInput): (date: Date) => boolean {
	const windowStart = input.now.getTime() - HABIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	return (date) => date.getTime() >= windowStart && date.getTime() <= input.now.getTime();
}

/** The median local hour of the shops on `weekday` in the window, or null when there are none. */
function shopHourOn(input: HabitInput, weekday: Weekday): number | null {
	const inWindow = windowFilter(input);
	const hours = input.shops
		.filter((shop) => inWindow(shop.occurredAt))
		.filter((shop) => weekdayOfDay(dayNumber(shop.occurredAt, input.timeZone)) === weekday)
		.map((shop) => localHour(shop.occurredAt, input.timeZone));
	return hours.length ? Math.round(median(hours)) % 24 : null;
}

function learnShopDays(input: HabitInput, inWindow: (date: Date) => boolean): ShopDay[] {
	const days = input.shops
		.filter((shop) => inWindow(shop.occurredAt))
		.map((shop) => dayNumber(shop.occurredAt, input.timeZone));
	return frequentWeekdays(days).map((weekday) => ({
		weekday,
		hour: shopHourOn(input, weekday) ?? DEFAULT_SHOP_HOUR,
		confirmed: false
	}));
}

/** Evening plans made in the window, as their creation times. */
function eveningPlans(input: HabitInput, inWindow: (date: Date) => boolean): Date[] {
	return input.plannedMeals
		.map((meal) => meal.createdAt)
		.filter((at) => inWindow(at) && localHour(at, input.timeZone) >= EVENING_FROM_HOUR);
}

/**
 * The usual planning hour on `weekday`: the median local hour, rounded down, at which plans were
 * made on that weekday's evenings in the window, or null when there are none.
 */
function planningHourOn(input: HabitInput, weekday: Weekday): number | null {
	const hours = eveningPlans(input, windowFilter(input))
		.filter((at) => weekdayOfDay(dayNumber(at, input.timeZone)) === weekday)
		.map((at) => localHour(at, input.timeZone));
	return hours.length ? Math.floor(median(hours)) : null;
}

/** Evenings the household plans on, with the usual hour (see {@link planningHourOn}). */
function learnPlanningEvenings(
	input: HabitInput,
	inWindow: (date: Date) => boolean
): PlanningEvening[] {
	const days = eveningPlans(input, inWindow).map((at) => dayNumber(at, input.timeZone));
	return frequentWeekdays(days).map((weekday) => ({
		weekday,
		hour: planningHourOn(input, weekday) ?? DEFAULT_PLANNING_HOUR
	}));
}

function learnDoneHabits(input: HabitInput): Record<string, ShopMethod> {
	const byMember = groupBy(
		input.shops.filter((shop) => shop.memberId !== null),
		(shop) => shop.memberId as string
	);
	const habits: Record<string, ShopMethod> = {};
	for (const [memberId, shops] of byMember) {
		const receipts = shops.filter((shop) => shop.method === 'RECEIPT').length;
		const ticks = shops.length - receipts;
		if (receipts !== ticks) {
			habits[memberId] = receipts > ticks ? 'RECEIPT' : 'TICK';
		} else {
			const latest = [...shops].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
			habits[memberId] = latest[0].method;
		}
	}
	return habits;
}

function learnPrepDay(input: HabitInput, inWindow: (date: Date) => boolean): Weekday | null {
	const prepDays = input.cooked
		.filter((cook) => inWindow(cook.occurredAt) && (cook.portions ?? 0) >= PREP_MIN_PORTIONS)
		.map((cook) => dayNumber(cook.occurredAt, input.timeZone));
	const counts = groupBy([...new Set(prepDays)], weekdayOfDay);
	let best: Weekday | null = null;
	let bestCount = HABIT_MIN_OCCURRENCES - 1;
	for (const [weekday, days] of counts) {
		if (days.length > bestCount) {
			best = weekday;
			bestCount = days.length;
		}
	}
	return best;
}

/**
 * How far ahead the household plans. Meals planned on the same local day form one planning
 * session; a session reaches as far as its furthest meal. The usual reach is the median.
 */
function learnPlanningStyle(
	input: HabitInput,
	inWindow: (date: Date) => boolean,
	prepDay: Weekday | null
): PlanningStyle {
	if (prepDay !== null) return 'prep';
	const meals = input.plannedMeals.filter((meal) => inWindow(meal.createdAt));
	if (meals.length === 0) return 'none';

	const sessions = groupBy(meals, (meal) => dayNumber(meal.createdAt, input.timeZone));
	const reaches = [...sessions.entries()].map(([plannedOn, session]) =>
		Math.max(...session.map((meal) => dayNumber(meal.plannedDate, input.timeZone) - plannedOn))
	);
	const reach = median(reaches);
	if (reach < 1) return 'none';
	if (reach < 5) return 'few';
	return 'week';
}

function learnUsuals(input: HabitInput): string[] {
	const usuals = new Set<string>();
	for (const [itemKey, buys] of groupBy(input.bought, (buy) => normalizeItemKey(buy.itemKey))) {
		const shops = new Set(buys.map((buy) => dayNumber(buy.occurredAt, input.timeZone)));
		if (shops.size >= USUAL_MIN_SHOPS) usuals.add(itemKey);
	}
	for (const record of input.purchaseCounts) {
		if (record.purchaseCount >= USUAL_MIN_SHOPS) usuals.add(normalizeItemKey(record.itemKey));
	}
	return [...usuals].sort();
}

/** Learns the household's routines from what it did; nobody sets them. */
export function learnHabits(input: HabitInput): Habits {
	const inWindow = windowFilter(input);
	const prepDay = learnPrepDay(input, inWindow);

	return {
		shopDays: learnShopDays(input, inWindow),
		planningEvenings: learnPlanningEvenings(input, inWindow),
		doneHabitByMember: learnDoneHabits(input),
		prepDay,
		planningStyle: learnPlanningStyle(input, inWindow, prepDay),
		usuals: learnUsuals(input)
	};
}

function answerKeys(answers: HabitAnswer[], value: HabitAnswer['answer']): Set<string> {
	return new Set(
		answers
			.filter((answer) => answer.answer === value)
			.map((answer) => {
				// Usual offers name an item; compare them by item key, like the usuals.
				const [kind, ...rest] = answer.key.split(':');
				return kind === 'usual' ? `usual:${normalizeItemKey(rest.join(':'))}` : answer.key;
			})
	);
}

function weekdaysAccepted(accepted: Set<string>, kind: string): Weekday[] {
	return [...accepted]
		.filter((key) => key.startsWith(`${kind}:`))
		.map((key) => Number(key.slice(kind.length + 1)))
		.filter(
			(weekday): weekday is Weekday => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
		);
}

/**
 * Applies the household's answers to the offers made from the learned habits. An offer key
 * names the habit: `shopDay:<weekday>`, `planningEvening:<weekday>`, `prepDay:<weekday>` or
 * `usual:<item>`.
 *
 * - A declined offer removes the habit, even when the history still shows it.
 * - An accepted offer keeps the habit when the recent history alone no longer shows it (a missed
 *   week), until the household declines it. An accepted shop day is marked `confirmed`; its hour
 *   is the median hour of its shops in `input`'s window, or {@link DEFAULT_SHOP_HOUR}; an
 *   accepted planning evening likewise takes its hour from the window's evening plans, or
 *   {@link DEFAULT_PLANNING_HOUR}. An
 *   accepted prep day fills the prep day only when none was learned: a newly learned prep day
 *   is a new offer.
 *
 * The planning style stays as learned: it describes what the household does, not an offer.
 */
export function applyHabitAnswers(
	habits: Habits,
	answers: HabitAnswer[],
	input?: HabitInput
): Habits {
	const declined = answerKeys(answers, 'declined');
	const accepted = answerKeys(answers, 'accepted');

	const shopDays = new Map<Weekday, ShopDay>();
	for (const day of habits.shopDays) {
		shopDays.set(day.weekday, { ...day, confirmed: accepted.has(`shopDay:${day.weekday}`) });
	}
	for (const weekday of weekdaysAccepted(accepted, 'shopDay')) {
		if (shopDays.has(weekday)) continue;
		const hour = (input && shopHourOn(input, weekday)) ?? DEFAULT_SHOP_HOUR;
		shopDays.set(weekday, { weekday, hour, confirmed: true });
	}

	const planningEvenings = new Map<Weekday, PlanningEvening>();
	for (const evening of habits.planningEvenings) planningEvenings.set(evening.weekday, evening);
	for (const weekday of weekdaysAccepted(accepted, 'planningEvening')) {
		if (planningEvenings.has(weekday)) continue;
		const hour = (input && planningHourOn(input, weekday)) ?? DEFAULT_PLANNING_HOUR;
		planningEvenings.set(weekday, { weekday, hour });
	}
	const learnedPrep =
		habits.prepDay !== null && !declined.has(`prepDay:${habits.prepDay}`) ? habits.prepDay : null;
	const acceptedPrep = weekdaysAccepted(accepted, 'prepDay').filter(
		(weekday) => !declined.has(`prepDay:${weekday}`)
	);
	const usuals = new Set([
		...habits.usuals,
		...[...accepted].filter((key) => key.startsWith('usual:')).map((key) => key.slice(6))
	]);

	return {
		...habits,
		shopDays: [...shopDays.values()]
			.filter((day) => !declined.has(`shopDay:${day.weekday}`))
			.sort((a, b) => a.weekday - b.weekday),
		planningEvenings: [...planningEvenings.values()]
			.filter((evening) => !declined.has(`planningEvening:${evening.weekday}`))
			.sort((a, b) => a.weekday - b.weekday),
		prepDay: learnedPrep ?? acceptedPrep[0] ?? null,
		usuals: [...usuals].filter((item) => !declined.has(`usual:${item}`)).sort()
	};
}
