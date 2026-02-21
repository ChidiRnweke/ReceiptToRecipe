export type MealTypeDao = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface MealLogDao {
	id: string;
	userId: string;
	recipeId: string | null;
	foodName: string;
	calories: number;
	consumedAt: Date;
	mealType: MealTypeDao;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewMealLogDao {
	userId: string;
	recipeId?: string | null;
	foodName: string;
	calories: number;
	consumedAt?: Date;
	mealType: MealTypeDao;
}

export interface UpdateMealLogDao {
	recipeId?: string | null;
	foodName?: string;
	calories?: number;
	consumedAt?: Date;
	mealType?: MealTypeDao;
}

export interface DailyCaloriesDao {
	date: string;
	calories: number;
}
