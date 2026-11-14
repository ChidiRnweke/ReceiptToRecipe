import type {
	HabitAnswer,
	Habits,
	PlanningStyle,
	ShopDay,
	ShopMethod,
	Weekday
} from '$lib/models/kitchen';
import { dayNumber, localHour, weekdayOfDay } from '../kitchen/days';

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

function learnShopDays(input: HabitInput, inWindow: (date: Date) => boolean): ShopDay[] {
	const shops = input.shops.filter((shop) => inWindow(shop.occurredAt));
	const days = shops.map((shop) => dayNumber(shop.occurredAt, input.timeZone));
	return frequentWeekdays(days).map((weekday) => {
		const hours = shops
			.filter((shop) => weekdayOfDay(dayNumber(shop.occurredAt, input.timeZone)) === weekday)
			.map((shop) => localHour(shop.occurredAt, input.timeZone));
		return { weekday, hour: Math.round(median(hours)) % 24 };
	});
}

function learnPlanningEvenings(input: HabitInput, inWindow: (date: Date) => boolean): Weekday[] {
	const evenings = input.plannedMeals
		.map((meal) => meal.createdAt)
		.filter((created) => inWindow(created))
		.filter((created) => localHour(created, input.timeZone) >= EVENING_FROM_HOUR)
		.map((created) => dayNumber(created, input.timeZone));
	return frequentWeekdays(evenings);
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
	for (const [itemKey, buys] of groupBy(input.bought, (buy) => buy.itemKey)) {
		const shops = new Set(buys.map((buy) => dayNumber(buy.occurredAt, input.timeZone)));
		if (shops.size >= USUAL_MIN_SHOPS) usuals.add(itemKey);
	}
	for (const record of input.purchaseCounts) {
		if (record.purchaseCount >= USUAL_MIN_SHOPS) usuals.add(record.itemKey);
	}
	return [...usuals].sort();
}

/** Learns the household's routines from what it did; nobody sets them. */
export function learnHabits(input: HabitInput): Habits {
	const windowStart = input.now.getTime() - HABIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	const inWindow = (date: Date) =>
		date.getTime() >= windowStart && date.getTime() <= input.now.getTime();
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

/**
 * Removes the learned habits the household turned down. An offer key names the habit:
 * `shopDay:<weekday>`, `planningEvening:<weekday>`, `prepDay:<weekday>` or `usual:<item>`.
 * The planning style stays as learned: it describes what the household does, not an offer.
 */
export function applyHabitAnswers(habits: Habits, answers: HabitAnswer[]): Habits {
	const declined = new Set(
		answers.filter((answer) => answer.answer === 'declined').map((answer) => answer.key)
	);
	const prepDay =
		habits.prepDay !== null && declined.has(`prepDay:${habits.prepDay}`) ? null : habits.prepDay;
	return {
		...habits,
		shopDays: habits.shopDays.filter((day) => !declined.has(`shopDay:${day.weekday}`)),
		planningEvenings: habits.planningEvenings.filter(
			(weekday) => !declined.has(`planningEvening:${weekday}`)
		),
		prepDay,
		usuals: habits.usuals.filter((item) => !declined.has(`usual:${item}`))
	};
}
