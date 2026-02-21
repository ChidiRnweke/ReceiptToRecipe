import type { MealTypeDao } from './MealLogDaos';

export interface PlannedMealDao {
	id: string;
	userId: string;
	recipeId: string | null;
	mealName: string;
	plannedDate: Date;
	plannedCalories: number;
	mealType: MealTypeDao;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewPlannedMealDao {
	userId: string;
	recipeId?: string | null;
	mealName: string;
	plannedDate: Date;
	plannedCalories: number;
	mealType: MealTypeDao;
}

export interface UpdatePlannedMealDao {
	recipeId?: string | null;
	mealName?: string;
	plannedDate?: Date;
	plannedCalories?: number;
	mealType?: MealTypeDao;
}

export interface DailyPlannedCaloriesDao {
	date: string;
	calories: number;
}
