import type { MealLogDao, NewMealLogDao, UpdateMealLogDao, DailyCaloriesDao } from '../daos';

export interface IMealLogRepository {
	findById(id: string): Promise<MealLogDao | null>;
	findByUserId(userId: string, limit?: number): Promise<MealLogDao[]>;
	findByUserIdAndRange(userId: string, start: Date, end: Date): Promise<MealLogDao[]>;
	findDailyCaloriesByUserIdAndRange(
		userId: string,
		start: Date,
		end: Date
	): Promise<DailyCaloriesDao[]>;
	create(log: NewMealLogDao): Promise<MealLogDao>;
	update(id: string, log: UpdateMealLogDao): Promise<MealLogDao>;
	delete(id: string): Promise<void>;
	countByUserId(userId: string): Promise<number>;
}
