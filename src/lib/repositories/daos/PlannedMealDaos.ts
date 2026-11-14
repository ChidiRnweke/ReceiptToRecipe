import type { MealTypeDao } from './MealLogDaos';

export type PlannedMealStatusDao = 'PLANNED' | 'COOKED' | 'SKIPPED' | 'EATEN_OUT';

export interface PlannedMealDao {
	id: string;
	userId: string;
	householdId: string;
	recipeId: string | null;
	mealName: string;
	plannedDate: Date;
	plannedCalories: number;
	mealType: MealTypeDao;
	status: PlannedMealStatusDao;
	servings: number | null;
	/** Portions cooked on top of the meal for later. */
	extraPortions: number;
	/** The meal this one is the leftover of. */
	leftoverOfId: string | null;
	/** A batch-prep cooking session. */
	isPrep: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewPlannedMealDao {
	userId: string;
	householdId: string;
	recipeId?: string | null;
	mealName: string;
	plannedDate: Date;
	plannedCalories: number;
	mealType: MealTypeDao;
	servings?: number | null;
	extraPortions?: number;
	leftoverOfId?: string | null;
	isPrep?: boolean;
}

export interface UpdatePlannedMealDao {
	recipeId?: string | null;
	mealName?: string;
	plannedDate?: Date;
	plannedCalories?: number;
	mealType?: MealTypeDao;
	status?: PlannedMealStatusDao;
	servings?: number | null;
	extraPortions?: number;
	leftoverOfId?: string | null;
}

export interface DailyPlannedCaloriesDao {
	date: string;
	calories: number;
}
