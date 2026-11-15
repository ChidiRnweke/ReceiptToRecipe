/**
 * Types of "Needs you": every question the app has for a member, behind one icon on every door.
 *
 * Each item has a stable key, so an answered question is not asked again, a sentence in the
 * prototype's wording, and the actions a member can take. An action names a command the server
 * runs (`NeedsYouController.answer`), or a page to open.
 */

import { z } from 'zod';

export type NeedsYouKind =
	| 'StillGotForTonight'
	| 'ProbablyGoneOff'
	| 'GoesOffToday'
	| 'MissingBeforeMeal'
	| 'OpenPlanDays'
	| 'PrepDay'
	| 'ShopDayOffer'
	| 'BackFromShop'
	| 'HouseholdEvent';

/** What an action does. `open` only navigates; every other command runs on the server. */
export type NeedsYouCommand =
	| 'kitchen.gone'
	| 'kitchen.stillGood'
	| 'tonight.quickGet'
	| 'habit.acceptShopDays'
	| 'shop.gotEverything'
	| 'dismiss'
	| 'open';

export interface NeedsYouAction {
	label: string;
	command: NeedsYouCommand;
	/** For `open`: the page to go to. */
	href?: string;
	/** A quiet button, such as "✕ Gone". */
	ghost?: boolean;
}

interface Base<K extends NeedsYouKind> {
	kind: K;
	/** Stable across visits while the question stands, e.g. `goneOff:tomato:20410`. */
	key: string;
	text: string;
	actions: NeedsYouAction[];
}

export interface StillGotForTonight extends Base<'StillGotForTonight'> {
	itemKey: string;
	plannedMealId: string;
}
export interface ProbablyGoneOff extends Base<'ProbablyGoneOff'> {
	itemKey: string;
}
export interface GoesOffToday extends Base<'GoesOffToday'> {
	itemKey: string;
	leftover: boolean;
}
export interface MissingBeforeMeal extends Base<'MissingBeforeMeal'> {
	plannedMealId: string;
	/** "Tomorrow’s shakshuka". */
	mealLabel: string;
	missing: string[];
}
export interface OpenPlanDays extends Base<'OpenPlanDays'> {
	days: number[];
}
export type PrepDay = Base<'PrepDay'>;
export interface ShopDayOffer extends Base<'ShopDayOffer'> {
	weekdays: number[];
}
export type BackFromShop = Base<'BackFromShop'>;
export interface HouseholdEventItem extends Base<'HouseholdEvent'> {
	eventId: string;
}

export type NeedsYouItem =
	| StillGotForTonight
	| ProbablyGoneOff
	| GoesOffToday
	| MissingBeforeMeal
	| OpenPlanDays
	| PrepDay
	| ShopDayOffer
	| BackFromShop
	| HouseholdEventItem;

export interface NeedsYouView {
	items: NeedsYouItem[];
	count: number;
}

export interface AnswerResult {
	/** A short line for the toast. */
	message: string;
}

export const answerInput = z.object({
	key: z.string().min(1).max(300),
	command: z.enum([
		'kitchen.gone',
		'kitchen.stillGood',
		'tonight.quickGet',
		'habit.acceptShopDays',
		'shop.gotEverything',
		'dismiss',
		'open'
	])
});

export type AnswerInput = z.infer<typeof answerInput>;
