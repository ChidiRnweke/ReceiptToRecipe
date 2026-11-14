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
}

export interface UpdatePlannedMealDao {
	recipeId?: string | null;
	mealName?: string;
	plannedDate?: Date;
	plannedCalories?: number;
	mealType?: MealTypeDao;
	status?: PlannedMealStatusDao;
	servings?: number | null;
}

export interface DailyPlannedCaloriesDao {
	date: string;
	calories: number;
}
