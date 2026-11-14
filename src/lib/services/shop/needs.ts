import { LEFTOVER_PREFIX, type Habits, type Lot, type MealNeed } from '$lib/models/kitchen';
import { MEAL_HOUR } from '$lib/models/plan';
import type {
	ShopMeal,
	ShopMoment,
	ShopNeedGroup,
	ShopNeedItem,
	ShopNeeds
} from '$lib/models/shop';
import { convertUnit, toBaseUnit } from '../kitchen/units';
import { atLocalHour, dayNumber, localHour, weekdayOfDay } from '../kitchen/days';
import { forecastMeals } from '../kitchen/forecastMeals';
import { upcomingShops } from '../plan/days';
import { sameItem } from '../tonight/items';

/** A learned shop this close counts as the shop the list is for. */
export const SCHEDULED_WITHIN_HOURS = 36;
/** Without a shop that close, the list covers the meals of the next two days. */
export const UNSCHEDULED_WINDOW_HOURS = 48;
/** Without a learned shop after the next one, the next shop covers a week. */
const DEFAULT_SHOP_GAP_HOURS = 7 * 24;
/** Without a second learned shop after the next one, held items wait four more days. */
const DEFAULT_LATER_HOURS = 4 * 24;
/** A usual runs low below this share of the amount usually bought. */
export const USUAL_LOW_SHARE = 0.3;

/** Rounds an amount up to what a shop sells: 50 g, 100 ml, whole items. */
export function roundPack(quantity: number, unit: string): number {
	if (unit === 'g') return Math.ceil(quantity / 50 - 1e-9) * 50;
	if (unit === 'ml') return Math.ceil(quantity / 100 - 1e-9) * 100;
	return Math.ceil(quantity - 1e-9);
}

/** The amount in g, ml or count when the unit is known, else as given. */
function inBase(quantity: number, unit: string): { quantity: number; unit: string } {
	return toBaseUnit(quantity, unit) ?? { quantity, unit };
}

interface Draft {
	itemKey: string;
	name: string;
	quantity: number;
	unit: string;
	mealIds: string[];
	alsoDays: number[];
}

/** Adds `item` into a matching draft (same item, convertible unit), or returns false. */
function mergeInto(drafts: Draft[], item: Draft, day: number): boolean {
	for (const draft of drafts) {
		if (!sameItem(draft.itemKey, item.itemKey)) continue;
		const converted = convertUnit(item.quantity, item.unit, draft.unit);
		if (converted === null) continue;
		draft.quantity += converted;
		draft.mealIds.push(...item.mealIds);
		if (!draft.alsoDays.includes(day)) draft.alsoDays.push(day);
		return true;
	}
	return false;
}

function finish(draft: Draft): ShopNeedItem {
	return {
		itemKey: draft.itemKey,
		name: draft.name,
		quantity: roundPack(draft.quantity, draft.unit),
		unit: draft.unit,
		mealIds: [...new Set(draft.mealIds)],
		alsoDays: draft.alsoDays
	};
}

/**
 * Merges the same item across dishes: the first dish that needs it lists it with the summed
 * amount, and the later dishes' days become its "also" days. Dishes left with nothing drop out.
 */
function mergeGroups(groups: { meal: ShopMeal; items: Draft[] }[]): ShopNeedGroup[] {
	const all: Draft[] = [];
	const out: { meal: ShopMeal; items: Draft[] }[] = [];
	for (const group of groups) {
		const kept: Draft[] = [];
		for (const item of group.items) {
			if (!mergeInto(all, item, group.meal.day)) {
				all.push(item);
				kept.push(item);
			}
		}
		if (kept.length) out.push({ meal: group.meal, items: kept });
	}
	return out.map((group) => ({ meal: group.meal, items: group.items.map(finish) }));
}

/** Hours from `now` until the meal's usual time on its day. */
function mealHoursAway(meal: ShopMeal, now: Date, timeZone: string): number {
	return (
		(meal.day - dayNumber(now, timeZone)) * 24 + MEAL_HOUR[meal.mealType] - localHour(now, timeZone)
	);
}

export interface ShopNeedsOptions {
	/** Items assumed to be home, e.g. staples for a household that does not track its kitchen. */
	skip?: (itemKey: string) => boolean;
}

/**
 * What the household needs to buy, ported from the prototype's `shopBuy` and `usualsLow`.
 *
 * With a learned shop within 36 hours, the list is for that shop. It buys what the meals after
 * it need up to the shop after that; the meals after that shop, up to the one after it, are held
 * back so their fresh things stay fresh. Without such a shop, the list covers the meals of the
 * next 48 hours. Meals before the shop eat from the kitchen first. The same item from several
 * dishes merges under the first dish, and every amount rounds up to a pack size. Usuals whose
 * stock fell below 30% of the amount usually bought join as "running low".
 */
export function buildShopNeeds(
	lots: Lot[],
	meals: ShopMeal[],
	habits: Pick<Habits, 'shopDays' | 'usuals'>,
	now: Date,
	timeZone: string,
	options: ShopNeedsOptions = {}
): ShopNeeds {
	const today = dayNumber(now, timeZone);
	const future = upcomingShops(habits.shopDays, now, timeZone).filter((s) => s.hoursAway > 0);
	const next = future[0] && future[0].hoursAway <= SCHEDULED_WITHIN_HOURS ? future[0] : null;
	// The moment comes from the learned hour, so it is the same on every call.
	const moment = (day: number): ShopMoment => ({
		day,
		at: atLocalHour(
			day,
			habits.shopDays.find((s) => s.weekday === weekdayOfDay(day))?.hour ?? 0,
			timeZone
		)
	});

	let from = 0;
	let nowUntil = UNSCHEDULED_WINDOW_HOURS;
	let laterUntil = UNSCHEDULED_WINDOW_HOURS;
	let after: (typeof future)[number] | null = null;
	if (next) {
		const following = future.filter((s) => s.hoursAway > next.hoursAway + 0.5);
		after = following[0] ?? null;
		from = next.hoursAway;
		nowUntil = following[0]?.hoursAway ?? next.hoursAway + DEFAULT_SHOP_GAP_HOURS;
		laterUntil = following[1]?.hoursAway ?? nowUntil + DEFAULT_LATER_HOURS;
	}

	const upcoming = meals
		.map((meal) => ({ meal, hours: mealHoursAway(meal, now, timeZone) }))
		.filter(({ hours }) => hours > 0 && hours <= laterUntil)
		.sort((a, b) => a.hours - b.hours);
	const needs: MealNeed[] = upcoming.map(({ meal }) => ({
		id: meal.id,
		day: meal.day,
		ingredients: meal.ingredients.map(({ itemKey, quantity, unit }) => ({
			itemKey,
			quantity,
			unit
		})),
		portions: meal.portions
	}));
	const forecast = forecastMeals(lots, needs, today, Number.MAX_SAFE_INTEGER);

	const nowGroups: { meal: ShopMeal; items: Draft[] }[] = [];
	const laterGroups: { meal: ShopMeal; items: Draft[] }[] = [];
	upcoming.forEach(({ meal, hours }, index) => {
		if (hours <= from) return;
		const items: Draft[] = forecast[index].missing
			.filter((m) => !m.itemKey.startsWith(LEFTOVER_PREFIX) && !options.skip?.(m.itemKey))
			.map((m) => ({
				itemKey: m.itemKey,
				name: meal.ingredients.find((i) => i.itemKey === m.itemKey)?.name ?? m.itemKey,
				...inBase(m.quantity, m.unit),
				mealIds: [meal.id],
				alsoDays: []
			}));
		if (!items.length) return;
		(hours <= nowUntil ? nowGroups : laterGroups).push({ meal, items });
	});

	const nowNeeds = mergeGroups(nowGroups);
	const listed = nowNeeds.flatMap((group) => group.items.map((item) => item.itemKey));
	return {
		nextShop: next ? moment(next.day) : null,
		afterShop: after ? moment(after.day) : null,
		now: nowNeeds,
		usuals: usualsLow(lots, habits.usuals, today).filter(
			(usual) => !listed.some((key) => sameItem(key, usual.itemKey))
		),
		later: mergeGroups(laterGroups)
	};
}

/**
 * Usuals whose good stock fell below 30% of the amount usually bought, which is the largest
 * purchase in the picture. A usual the picture has never seen bought is not known to be low.
 */
export function usualsLow(lots: Lot[], usuals: string[], day: number): ShopNeedItem[] {
	const out: ShopNeedItem[] = [];
	for (const itemKey of usuals) {
		const bought = lots.filter((lot) => lot.source === 'bought' && sameItem(lot.itemKey, itemKey));
		if (!bought.length) continue;
		const size = bought.reduce((a, b) => (b.initialQuantity > a.initialQuantity ? b : a));
		const have = bought
			.filter((lot) => lot.expiresOn >= day)
			.reduce((sum, lot) => sum + (convertUnit(lot.quantity, lot.unit, size.unit) ?? 0), 0);
		if (have >= size.initialQuantity * USUAL_LOW_SHARE) continue;
		out.push({
			itemKey,
			name: itemKey,
			quantity: roundPack(size.initialQuantity, size.unit),
			unit: size.unit,
			mealIds: [],
			alsoDays: []
		});
	}
	return out;
}
