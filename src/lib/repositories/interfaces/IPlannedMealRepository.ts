import type {
	PlannedMealDao,
	NewPlannedMealDao,
	UpdatePlannedMealDao,
	DailyPlannedCaloriesDao
} from '../daos';

export interface IPlannedMealRepository {
	findById(id: string): Promise<PlannedMealDao | null>;
	findByUserId(userId: string, limit?: number): Promise<PlannedMealDao[]>;
	findByUserIdAndRange(userId: string, start: Date, end: Date): Promise<PlannedMealDao[]>;
	deleteByUserIdAndRange(userId: string, start: Date, end: Date): Promise<void>;
	findDailyCaloriesByUserIdAndRange(
		userId: string,
		start: Date,
		end: Date
	): Promise<DailyPlannedCaloriesDao[]>;
	create(meal: NewPlannedMealDao): Promise<PlannedMealDao>;
	update(id: string, meal: UpdatePlannedMealDao): Promise<PlannedMealDao>;
	delete(id: string): Promise<void>;
}
