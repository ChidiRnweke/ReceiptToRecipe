/**
 * Kitchen domain types.
 *
 * The app keeps a running estimate of what is in a household's kitchen. Nobody types the stock
 * in: it is projected from an append-only log of kitchen events (bought, cooked, corrected).
 *
 * Days are local calendar days, counted from 1970-01-01 in the household's time zone, so that
 * "expires on day 20410" and "cooked on day 20408" compare as plain numbers. Weekdays run from
 * 0 (Monday) to 6 (Sunday).
 */

export type KitchenEventKind =
	| 'BOUGHT'
	| 'COOKED'
	| 'CORRECTED_GONE'
	| 'CORRECTED_STILL_GOOD'
	| 'CORRECTED_QUANTITY'
	| 'SHOP_DONE';

/** How a shop was closed: a photographed receipt, or ticking the list ("got everything"). */
export type ShopMethod = 'RECEIPT' | 'TICK';

export type PlannedMealStatus = 'PLANNED' | 'COOKED' | 'SKIPPED' | 'EATEN_OUT';

/** 0 = Monday … 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One ingredient a cooked meal used, already scaled to the servings cooked. */
export interface UsedIngredient {
	itemKey: string;
	quantity: number;
	unit: string;
	/** True when the recipe unit could not be converted, so the amount is a guess. */
	estimate?: boolean;
}

export interface KitchenEventPayload {
	/** Product category of a bought item; drives its shelf life. */
	category?: string | null;
	/** Ingredients a COOKED event consumed. */
	ingredients?: UsedIngredient[];
	servings?: number;
	/** Where the event came from, e.g. `receipt`, `manual`, `list`. */
	source?: string;
	[key: string]: unknown;
}

export interface KitchenEvent {
	id: string;
	householdId: string;
	actorUserId: string | null;
	occurredAt: Date;
	kind: KitchenEventKind;
	/** Normalized lower-case item name. Null for SHOP_DONE and COOKED. */
	itemKey: string | null;
	quantity: number | null;
	unit: string | null;
	expiresAt: Date | null;
	known: boolean;
	/** Portions a COOKED event put aside as leftovers or batch-cooked lunches. */
	portions: number | null;
	receiptItemId: string | null;
	plannedMealId: string | null;
	recipeId: string | null;
	method: ShopMethod | null;
	payload: KitchenEventPayload | null;
	createdAt: Date;
}

export interface NewKitchenEvent {
	householdId: string;
	actorUserId?: string | null;
	occurredAt: Date;
	kind: KitchenEventKind;
	itemKey?: string | null;
	quantity?: number | null;
	unit?: string | null;
	expiresAt?: Date | null;
	known?: boolean;
	portions?: number | null;
	receiptItemId?: string | null;
	plannedMealId?: string | null;
	recipeId?: string | null;
	method?: ShopMethod | null;
	payload?: KitchenEventPayload | null;
}

export type LotSource = 'bought' | 'leftover' | 'corrected';

/** One batch of an item in the kitchen: what one purchase or one cooked meal left behind. */
export interface Lot {
	itemKey: string;
	quantity: number;
	/** Quantity when the lot came in; the scrap rule measures against it. */
	initialQuantity: number;
	unit: string;
	/** Last local day the lot is good. */
	expiresOn: number;
	/** False once cooking has drawn on it, because the amount used is an estimate. */
	known: boolean;
	/** Shelf life of 7 days or less. */
	perishable: boolean;
	source: LotSource;
}

/** What the kitchen holds of one item on a given day. */
export interface StockItem {
	itemKey: string;
	/** Sum of the lots that are still good. */
	quantity: number;
	unit: string;
	/** Soonest expiry of the good lots, or the latest expiry when only expired lots remain. */
	expiresOn: number;
	known: boolean;
	/** Only expired lots remain. */
	off: boolean;
	/** The planned meal (or cooking event) these leftovers came from. */
	leftoverOf?: string;
}

export interface Quantity {
	itemKey: string;
	quantity: number;
	unit: string;
}

/** A future meal for the forecast: what it uses and what it puts aside. */
export interface MealNeed {
	id: string;
	/** Local day the meal happens. */
	day: number;
	ingredients: Quantity[];
	/** Portions the meal puts aside as a leftover lot `leftover:<id>`. */
	portions?: number;
}

export interface MealForecast {
	meal: MealNeed;
	missing: Quantity[];
}

export type PlanningStyle = 'none' | 'few' | 'week' | 'prep';

export interface ShopDay {
	weekday: Weekday;
	/** Usual local hour of the shop, 0–23. */
	hour: number;
}

export interface Habits {
	shopDays: ShopDay[];
	planningEvenings: Weekday[];
	/** Keyed by household member id. */
	doneHabitByMember: Record<string, ShopMethod>;
	prepDay: Weekday | null;
	planningStyle: PlanningStyle;
	usuals: string[];
}

export type HabitAnswerValue = 'accepted' | 'declined';

export interface HabitAnswer {
	householdId: string;
	/** The offer answered, e.g. `shopDay:4`, `planningEvening:2`, `prepDay:6`, `usual:milk`. */
	key: string;
	answer: HabitAnswerValue;
	answeredBy: string | null;
	answeredAt: Date;
}

/** Prefix of the item key of a leftover lot. */
export const LEFTOVER_PREFIX = 'leftover:';

/** Leftovers and batch-cooked portions keep this many days after the cooking day. */
export const LEFTOVER_KEEP_DAYS = 4;

/** Lots with a shelf life up to this many days are perishable. */
export const PERISHABLE_MAX_DAYS = 7;

/** A perishable lot cooked down below this share of its original quantity is finished. */
export const SCRAP_SHARE = 0.15;

/** The trimmed, single-spaced, lower-case name used as an item key. */
export function normalizeItemKey(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function leftoverKey(sourceId: string): string {
	return `${LEFTOVER_PREFIX}${sourceId}`;
}
