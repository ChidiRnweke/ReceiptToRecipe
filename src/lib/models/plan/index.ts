/**
 * Meal plan types.
 *
 * A planned meal belongs to the household and sits on one local day. Its stored `plannedDate`
 * is a moment on that day (noon local time), so the day is read back in the household's time
 * zone.
 */

import type { PlannedMealStatus } from '$lib/models/kitchen';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

/** The fields of a planned meal the plan rules read. */
export interface PlannedMealSlot {
	id: string;
	recipeId: string | null;
	plannedDate: Date;
	mealType: MealType;
	status: PlannedMealStatus;
}

/** Planned meals are stored at this local hour of their day. */
export const PLANNED_MEAL_HOUR = 12;

/** Usual local hours of a meal, for "does the shop happen before it". */
export const MEAL_HOUR: Record<MealType, number> = {
	BREAKFAST: 8,
	LUNCH: 12.5,
	DINNER: 19,
	SNACK: 16
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
