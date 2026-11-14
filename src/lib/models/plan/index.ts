/**
 * Meal plan types.
 *
 * A planned meal belongs to the household and sits on one local day. Its stored `plannedDate`
 * is a moment on that day (noon local time), so the day is read back in the household's time
 * zone.
 */

import type { PlannedMealStatus, PlanningStyle, Weekday } from '$lib/models/kitchen';

/** PREP is a batch-cooking session: it makes the lunches of the following days. */
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'PREP';

/** The fields of a planned meal the plan rules read. */
export interface PlannedMealSlot {
	id: string;
	recipeId: string | null;
	plannedDate: Date;
	mealType: MealType;
	status: PlannedMealStatus;
	/** A batch-prep cooking session rather than a meal eaten then. */
	isPrep: boolean;
}

/** Planned meals are stored at this local hour of their day. */
export const PLANNED_MEAL_HOUR = 12;

/** Usual local hours of a meal, for "does the shop happen before it". */
export const MEAL_HOUR: Record<MealType, number> = {
	BREAKFAST: 8,
	LUNCH: 12.5,
	DINNER: 19,
	SNACK: 16,
	PREP: 11
};

/** A meal that is moved to make room goes at most this many days later. */
export const MOVE_MAX_DAYS = 3;

/** What `moveToNextFreeDay` did with a meal. */
export interface MoveResult {
	/** The moment on the new day, or null when no day was free and the meal left the plan. */
	movedTo: Date | null;
	/** The perishable ingredient whose expiry limited the move, and its last good moment. */
	keptBy: { itemKey: string; until: Date } | null;
}

/** A recipe as the plan rules see it: what it is called and what it uses. */
export interface PlanRecipe {
	id: string;
	title: string;
	ingredients: { itemKey: string; quantity: number; unit: string }[];
}

/** A planned meal with the fields the Plan door reads. */
export interface PlannedMealRecord extends PlannedMealSlot {
	mealName: string;
	servings: number | null;
	/** Portions cooked on top of the meal for later. */
	extraPortions: number;
	/** The meal this one is the leftover of. */
	leftoverOfId: string | null;
}

/** What the Plan door needs to know about a recipe. */
export interface PlanRecipeInfo {
	id: string;
	title: string;
	imageUrl: string | null;
	servings: number;
	minutes: number | null;
	calories: number | null;
	steps: string[];
}

/** The slots the Plan door fills. */
export type PlanSlotType = Extract<MealType, 'LUNCH' | 'DINNER'>;

/** Why the stretch covers the days it does. `custom` is a range the member picked. */
export type StretchReason = 'until-shop' | 'week' | 'few' | 'custom';

/** Local days of a plan: `start` inclusive, `end` exclusive. */
export interface PlanRange {
	start: number;
	end: number;
}

export interface PlanStretch extends PlanRange {
	reason: StretchReason;
}

/** A meal slot in the range with nothing planned. */
export interface PlanGap {
	day: number;
	mealType: PlanSlotType;
}

/** The longest stretch the Plan door plans in one go. */
export const MAX_STRETCH_DAYS = 10;
/** The day strip shows this many days from today. */
export const STRIP_DAYS = 10;

/** One day of the strip. */
export interface PlanStripDay {
	day: number;
	weekday: Weekday;
	/** Day of the month. */
	date: number;
	dish: { name: string; hue: number } | null;
	shopDay: boolean;
}

/** A planned meal as a slot row shows it. */
export interface PlanSlotMeal {
	plannedMealId: string;
	recipeId: string | null;
	title: string;
	imageUrl: string | null;
	/** A leftover of another meal: "from the pot". */
	fromThePot: boolean;
	/** Cooked for two days: "+ tomorrow's lunch". */
	withLunch: boolean;
	/** Servings when they differ from the recipe's, for "for 4". */
	servings: number | null;
	/** The household has not cooked it before. */
	isNew: boolean;
	/** It keeps, so "Cook for two days" is offered. */
	keepsWell: boolean;
	isPrep: boolean;
}

export interface PlanSlot {
	day: number;
	weekday: Weekday;
	date: number;
	mealType: PlanSlotType;
	meal: PlanSlotMeal | null;
}

/** A recipe offered for a slot or in "Something new". */
export interface PlanIdea {
	recipeId: string;
	title: string;
	imageUrl: string | null;
	minutes: number | null;
	calories: number | null;
	uses: string[];
	missing: string[];
	isNew: boolean;
	keepsWell: boolean;
}

/** A merged prep step: its leading verb, the rest, and the dish it belongs to. */
export interface PrepStep {
	verb: string | null;
	text: string;
	/** Short name of the dish, e.g. "curry". */
	dish: string;
}

export interface PrepMeal {
	plannedMealId: string;
	recipeId: string | null;
	title: string;
	imageUrl: string | null;
	boxes: number;
	calories: number | null;
	missing: string[];
}

export interface PrepBox {
	day: number;
	weekday: Weekday;
	hue: number;
}

/** The prep session the Plan door leads with on and around the prep day. */
export interface PrepView {
	day: number;
	weekday: Weekday;
	meals: PrepMeal[];
	boxes: PrepBox[];
	/** Every prep meal is cooked: the boxes are in the fridge. */
	done: boolean;
	/** Average calories of a box; protein is not stored. */
	caloriesPerBox: number | null;
	/** "Both in one go · about N min". */
	minutes: number | null;
	steps: PrepStep[];
	/** The last day a box covers. */
	lastLunchWeekday: Weekday | null;
}

/** Everything the Plan door shows. */
export interface PlanView {
	greeting: string;
	question: string;
	today: number;
	style: PlanningStyle;
	/** The household's learned prep day, or null. */
	prepDay: Weekday | null;
	/** The next local day on the prep day, from today, when the household preps. */
	nextPrepDay: number | null;
	days: PlanStripDay[];
	stretch: PlanStretch;
	stretchLine: string;
	/** Dinner, plus lunch for a household that preps. */
	slotTypes: PlanSlotType[];
	slots: PlanSlot[];
	gaps: PlanGap[];
	fillLabel: string;
	discover: PlanIdea[];
	prep: PrepView | null;
	/** Ingredients the planned meals still need from the shop. */
	toBuy: number;
	/** The household does not plan: show "No plan needed". */
	slim: boolean;
}

/** What a plan command did, for the toast. */
export interface PlanResult {
	message: string;
}
