import type { HouseholdEvent } from '$lib/models/household';
import type { Habits, PlannedMealStatus, Weekday } from '$lib/models/kitchen';
import type { MealType } from '$lib/models/plan';
import type {
	BackFromShop,
	GoesOffToday,
	HouseholdEventItem,
	MissingBeforeMeal,
	NeedsYouAction,
	NeedsYouItem,
	OpenPlanDays,
	PrepDay,
	ProbablyGoneOff,
	ShopDayOffer,
	StillGotForTonight
} from '$lib/models/needsyou';
import { atLocalHour, weekdayOfDay } from '../kitchen/days';
import { upcomingShops } from '../plan/days';
import { weekdayName } from '../tonight/copy';
import { listNames, type RankStock } from '../tonight/items';
import { isLeftover } from '../useitup/eatFirst';

const HOUR_MS = 60 * 60 * 1000;
/** A meal this many hours ahead or fewer is checked for missing items. */
export const MISSING_WITHIN_HOURS = 50;
/** Days after today checked for a dinner, for households that plan. */
export const OPEN_PLAN_DAYS = 3;
/** "Back from the shop?" asks this many hours after the usual shop time. */
export const BACK_FROM_SHOP_HOURS = 3;
/** A household event is news for this many hours. */
export const HOUSEHOLD_EVENT_HOURS = 10;
/** Before this local hour the day's meal is "today's", after it "tonight's". */
const TONIGHT_FROM_HOUR = 14;

/** A planned meal as the rules see it. */
export interface NeedsYouMeal {
	id: string;
	title: string;
	day: number;
	mealType: MealType;
	status: PlannedMealStatus;
	isPrep: boolean;
	/** The meal is the leftover of another one, so it needs nothing bought. */
	leftover: boolean;
	/** Hours from now until the meal's usual time. */
	hoursAway: number;
	/** Its ingredients, by the kitchen's item key and as the recipe names them. */
	ingredients: { itemKey: string; name: string }[];
	/** Ingredients the forecast says will be missing, as the recipe names them. */
	missing: string[];
}

export interface NeedsYouMember {
	userId: string;
	firstName: string;
}

/** Everything the rules read for one member at one moment. */
export interface NeedsYouContext {
	now: Date;
	timeZone: string;
	today: number;
	/** Local hour of `now`, e.g. 18.5. */
	hour: number;
	viewer: { userId: string; memberId: string; shops: boolean };
	members: NeedsYouMember[];
	/** The household records what it buys. */
	tracks: boolean;
	stock: RankStock[];
	/** The meal Tonight answers for, when it is planned and not yet eaten. */
	tonight: NeedsYouMeal | null;
	/** Planned meals from today on, in order. */
	meals: NeedsYouMeal[];
	/** Local days that have a dinner that was not skipped. */
	dinnerDays: number[];
	habits: Habits;
	lastShopDoneAt: Date | null;
	/** Household events of the last hours, newest first. */
	events: HouseholdEvent[];
	/** Keys of the questions this member already answered. */
	answered: Set<string>;
}

const plural = (name: string) => /s$/i.test(name.trim());
const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);
const open = (label: string, href: string): NeedsYouAction => ({ label, command: 'open', href });

/** "today’s", "tonight’s", "tomorrow’s", "Thursday’s". */
export function relativeDay(day: number, today: number, hour: number): string {
	if (day === today) return hour < TONIGHT_FROM_HOUR ? 'today’s' : 'tonight’s';
	if (day === today + 1) return 'tomorrow’s';
	return `${weekdayName(weekdayOfDay(day))}’s`;
}

/** An estimated perishable that tonight's meal needs: "Still got feta for tonight’s shakshuka?" */
export function stillGotForTonight(ctx: NeedsYouContext): StillGotForTonight[] {
	const meal = ctx.tonight;
	if (!ctx.tracks || !meal || meal.leftover) return [];
	for (const ingredient of meal.ingredients) {
		const key = `stillGot:${meal.id}:${ingredient.itemKey}`;
		if (ctx.answered.has(key)) continue;
		const item = ctx.stock.find((x) => x.itemKey === ingredient.itemKey);
		if (!item || item.known || item.off || !item.perishable) continue;
		return [
			{
				kind: 'StillGotForTonight',
				key,
				itemKey: item.itemKey,
				plannedMealId: meal.id,
				text: `Still got ${item.name.toLowerCase()} for ${relativeDay(meal.day, ctx.today, ctx.hour)} ${meal.title.toLowerCase()}?`,
				actions: [
					{ label: '✓', command: 'kitchen.stillGood' },
					{ label: '✕ Gone', command: 'kitchen.gone', ghost: true }
				]
			}
		];
	}
	return [];
}

/** "Tomatoes have probably gone off". */
export function probablyGoneOff(ctx: NeedsYouContext): ProbablyGoneOff[] {
	return ctx.stock
		.filter((item) => item.off)
		.map((item) => ({
			kind: 'ProbablyGoneOff' as const,
			key: `goneOff:${item.itemKey}:${item.expiresOn}`,
			itemKey: item.itemKey,
			text: `${item.name} ${plural(item.name) ? 'have' : 'has'} probably gone off`,
			actions: [
				{ label: '✕ Binned', command: 'kitchen.gone' as const, ghost: true },
				{ label: '↺ Still good', command: 'kitchen.stillGood' as const }
			]
		}));
}

/** "Spinach goes off today", "Saag paneer needs eating today". */
export function goesOffToday(ctx: NeedsYouContext): GoesOffToday[] {
	return ctx.stock
		.filter((item) => !item.off && item.expiresOn === ctx.today)
		.filter((item) => item.perishable || isLeftover(item.itemKey))
		.map((item) => {
			const leftover = isLeftover(item.itemKey);
			const gone: NeedsYouAction = { label: '✕ Gone', command: 'kitchen.gone', ghost: true };
			return {
				kind: 'GoesOffToday' as const,
				key: `goesOffToday:${item.itemKey}:${ctx.today}`,
				itemKey: item.itemKey,
				leftover,
				text: leftover
					? `${item.name} needs eating today`
					: `${item.name} ${plural(item.name) ? 'go' : 'goes'} off today`,
				actions: leftover
					? [gone]
					: [open('Ideas', `/use-it-up?ideas=${encodeURIComponent(item.itemKey)}`), gone]
			};
		});
}

/**
 * A planned meal in the next two days that lacks items, with no learned shop before it:
 * "Tomorrow’s shakshuka needs eggs and feta". Only the first such meal is asked about.
 */
export function missingBeforeMeal(ctx: NeedsYouContext): MissingBeforeMeal[] {
	if (!ctx.tracks) return [];
	const shops = upcomingShops(ctx.habits.shopDays, ctx.now, ctx.timeZone, 4);
	for (const meal of ctx.meals) {
		if (meal.leftover || meal.isPrep || meal.status !== 'PLANNED') continue;
		if (meal.id === ctx.tonight?.id) continue;
		if (meal.hoursAway <= 0 || meal.hoursAway > MISSING_WITHIN_HOURS) continue;
		if (shops.some((shop) => shop.hoursAway > 0 && shop.hoursAway < meal.hoursAway)) continue;
		if (!meal.missing.length) continue;
		const mealLabel = `${capitalise(relativeDay(meal.day, ctx.today, ctx.hour))} ${meal.title.toLowerCase()}`;
		return [
			{
				kind: 'MissingBeforeMeal',
				key: `missing:${meal.id}`,
				plannedMealId: meal.id,
				mealLabel,
				missing: meal.missing,
				text: `${mealLabel} needs ${listNames(meal.missing)}`,
				actions: [
					{ label: 'Get it on the way', command: 'tonight.quickGet' },
					open('Swap', '/plan')
				]
			}
		];
	}
	return [];
}

/** "Nothing planned for Tuesday and Wednesday", for households that plan their dinners. */
export function openPlanDays(ctx: NeedsYouContext): OpenPlanDays[] {
	if (ctx.habits.planningStyle === 'none' || ctx.habits.planningStyle === 'prep') return [];
	const days: number[] = [];
	for (let day = ctx.today + 1; day <= ctx.today + OPEN_PLAN_DAYS; day++) {
		if (!ctx.dinnerDays.includes(day)) days.push(day);
	}
	if (!days.length) return [];
	return [
		{
			kind: 'OpenPlanDays',
			key: `openDays:${days.join(',')}`,
			days,
			text: `Nothing planned for ${listNames(days.map((day) => weekdayName(weekdayOfDay(day))))}`,
			actions: [open('Plan', '/plan')]
		}
	];
}

/** "Prep day: lunches to cook", on the learned prep day while its prep is not cooked. */
export function prepDay(ctx: NeedsYouContext): PrepDay[] {
	if (ctx.habits.prepDay !== weekdayOfDay(ctx.today)) return [];
	const waiting = ctx.meals.some(
		(meal) => meal.isPrep && meal.day === ctx.today && meal.status === 'PLANNED'
	);
	if (!waiting) return [];
	return [
		{
			kind: 'PrepDay',
			key: `prep:${ctx.today}`,
			text: 'Prep day: lunches to cook',
			actions: [open('Prep', '/plan')]
		}
	];
}

/** "You seem to shop on Thursdays. Plan around that?", for learned shop days nobody confirmed. */
export function shopDayOffer(ctx: NeedsYouContext): ShopDayOffer[] {
	const weekdays = ctx.habits.shopDays
		.filter((day) => !day.confirmed)
		.map((day) => day.weekday)
		.sort((a, b) => a - b);
	if (!weekdays.length) return [];
	return [
		{
			kind: 'ShopDayOffer',
			key: `shopDayOffer:${weekdays.join(',')}`,
			weekdays,
			text: `You seem to shop on ${listNames(weekdays.map((d) => `${weekdayName(d as Weekday)}s`))}. Plan around that?`,
			actions: [
				{ label: 'Yes', command: 'habit.acceptShopDays' },
				{ label: 'Not now', command: 'dismiss', ghost: true }
			]
		}
	];
}

/**
 * "Back from Thursday’s shop?": a learned shop time passed in the last three hours and no shop
 * was recorded around it. Asked of the member who shops. A member who usually ticks the list
 * sees "Got everything" first; everyone else sees "Snap the receipt" first.
 */
export function backFromShop(ctx: NeedsYouContext): BackFromShop[] {
	if (!ctx.viewer.shops && ctx.members.length > 1) return [];
	const now = ctx.now.getTime();
	let latest: { day: number; at: number } | null = null;
	for (const shop of ctx.habits.shopDays) {
		for (const day of [ctx.today - 1, ctx.today]) {
			if (weekdayOfDay(day) !== shop.weekday) continue;
			const at = atLocalHour(day, shop.hour, ctx.timeZone).getTime();
			if (at > now || now - at > BACK_FROM_SHOP_HOURS * HOUR_MS) continue;
			if (!latest || at > latest.at) latest = { day, at };
		}
	}
	if (!latest) return [];
	const recorded = ctx.lastShopDoneAt?.getTime();
	if (recorded !== undefined && recorded >= latest.at - BACK_FROM_SHOP_HOURS * HOUR_MS) return [];

	const snap = open('Snap the receipt', '/shop?snap=1');
	const got: NeedsYouAction = { label: 'Got everything', command: 'shop.gotEverything' };
	const ticks = ctx.habits.doneHabitByMember[ctx.viewer.memberId] === 'TICK';
	return [
		{
			kind: 'BackFromShop',
			key: `backFromShop:${latest.day}`,
			text: `Back from ${weekdayName(weekdayOfDay(latest.day))}’s shop?`,
			actions: ticks ? [got, snap] : [snap, got]
		}
	];
}

/** What a household event says after the member's name: "got the shopping". */
export function eventText(event: HouseholdEvent, today: number): string | null {
	const short = (day: number) => weekdayName(weekdayOfDay(day)).slice(0, 3);
	switch (event.kind) {
		case 'SHOP_DONE':
			return 'got the shopping';
		case 'PLANNED': {
			const { from, to } = event.payload;
			if (typeof from !== 'number' || typeof to !== 'number') return 'planned some meals';
			return from === to
				? `planned ${weekdayName(weekdayOfDay(from))}`
				: `planned ${short(from)}–${short(to)}`;
		}
		case 'EATING_OUT':
			return event.payload.day === today ? 'says you’re eating out tonight' : null;
		case 'COOKED':
			return event.payload.title ? `cooked ${event.payload.title.toLowerCase()}` : 'cooked dinner';
		case 'JOINED':
			return 'joined the household';
	}
}

/** The latest thing another member did in the last ten hours: "Sam got the shopping". */
export function householdEvent(ctx: NeedsYouContext): HouseholdEventItem[] {
	const since = ctx.now.getTime() - HOUSEHOLD_EVENT_HOURS * HOUR_MS;
	for (const event of ctx.events) {
		const at = event.createdAt.getTime();
		if (at > ctx.now.getTime() || at < since) continue;
		if (!event.actorUserId || event.actorUserId === ctx.viewer.userId) continue;
		const key = `event:${event.id}`;
		if (ctx.answered.has(key)) continue;
		const member = ctx.members.find((m) => m.userId === event.actorUserId);
		const text = eventText(event, ctx.today);
		if (!member || !text) continue;
		const actions: NeedsYouAction[] =
			event.kind === 'SHOP_DONE' && ctx.tracks ? [open('What came home', '/use-it-up')] : [];
		return [
			{
				kind: 'HouseholdEvent',
				key,
				eventId: event.id,
				text: `${member.firstName} ${text}`,
				actions: [...actions, { label: 'Got it', command: 'dismiss', ghost: true }]
			}
		];
	}
	return [];
}

/** Every question for the member, in the order they are shown; answered ones are left out. */
export function collectNeedsYou(ctx: NeedsYouContext): NeedsYouItem[] {
	const items: NeedsYouItem[] = [
		...stillGotForTonight(ctx),
		...probablyGoneOff(ctx),
		...goesOffToday(ctx),
		...missingBeforeMeal(ctx),
		...openPlanDays(ctx),
		...prepDay(ctx),
		...shopDayOffer(ctx),
		...backFromShop(ctx),
		...householdEvent(ctx)
	];
	return items.filter((item) => !ctx.answered.has(item.key));
}
