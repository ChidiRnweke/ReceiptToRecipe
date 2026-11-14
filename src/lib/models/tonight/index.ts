/**
 * Types of the Tonight door and the front door.
 *
 * Tonight answers "what's for dinner?" with one card: the meal that fits the moment, or a few
 * ideas when nothing is planned.
 */

import type { Weekday } from '$lib/models/kitchen';

export type TonightSlot = 'lunch' | 'dinner';

/** A learned shop that happens before a meal. */
export interface ShopBefore {
	weekday: Weekday;
	/** 0 for today, 1 for tomorrow. */
	daysAway: number;
	/** First name of the member who shops, when it is not the viewer; null otherwise. */
	shopper: string | null;
}

/** Doors the front door can open. Recipes is never chosen automatically. */
export type FrontDoor = 'tonight' | 'plan' | 'shop' | 'use-it-up';

export interface DoorChoice {
	door: FrontDoor;
	/** A short plain sentence that says why, for logs and tests. */
	reason: string;
}

/** An ingredient line of the cook sheet, scaled to the servings cooked. */
export interface CookIngredient {
	name: string;
	quantity: number;
	unit: string;
	/** Not in the kitchen, so it has to be bought. */
	missing: boolean;
}

/** One recipe offered as an idea or alternative. */
export interface TonightIdea {
	recipeId: string;
	title: string;
	imageUrl: string | null;
	minutes: number | null;
	calories: number | null;
	/** Perishables in the kitchen it would use before they go. */
	uses: string[];
	/** Ingredients the kitchen does not have. */
	missing: string[];
	servings: number;
	ingredients: CookIngredient[];
	steps: string[];
}

export interface TonightMeal extends TonightIdea {
	plannedMealId: string;
	/** True when the household does not track its kitchen, so nothing is known to be missing. */
	untracked: boolean;
	/** The learned shop that happens before the meal, when something is missing. */
	shopBefore: ShopBefore | null;
}

export type TonightState = 'planned' | 'eaten' | 'out' | 'ideas';

export interface TonightView {
	/** "Good evening, Noor". */
	greeting: string;
	/** "What's for *dinner*?", with the highlighted word in stars. */
	question: string;
	slot: TonightSlot;
	/** The meal is tomorrow's dinner, because tonight is over. */
	tomorrow: boolean;
	state: TonightState;
	meal: TonightMeal | null;
	/** Three ideas when nothing is planned. */
	ideas: TonightIdea[];
	/** Tomorrow's dinner, shown under the card. */
	tomorrowLine: { title: string; everythingHome: boolean } | null;
	/** Calories left today for a member with a goal, else null. */
	calorieLeft: number | null;
}

export interface CookResult {
	plannedMealId: string;
	title: string;
}

export interface EatOutResult {
	/** The dinner that was planned, if any. */
	title: string | null;
	/** Day offset from today the dinner moved to, or null when it left the plan or none existed. */
	movedToDays: number | null;
	movedToWeekday: Weekday | null;
	/** The perishable that limited the move, and the weekday it keeps till. */
	keptBy: { itemKey: string; weekday: Weekday } | null;
	/** With nothing planned: a perishable that goes off by tomorrow. */
	firstInLine: { itemKey: string; tonight: boolean } | null;
	message: string;
}

export interface PickResult {
	title: string;
	message: string;
}
