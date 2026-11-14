import type {
	PlannedMealDao,
	NewPlannedMealDao,
	UpdatePlannedMealDao,
	DailyPlannedCaloriesDao
} from '../daos';

export interface IPlannedMealRepository {
	findById(id: string): Promise<PlannedMealDao | null>;
	findByHouseholdId(householdId: string, limit?: number): Promise<PlannedMealDao[]>;
	findByHouseholdIdAndRange(householdId: string, start: Date, end: Date): Promise<PlannedMealDao[]>;
	deleteByHouseholdIdAndRange(householdId: string, start: Date, end: Date): Promise<void>;
	findDailyCaloriesByHouseholdIdAndRange(
		householdId: string,
		start: Date,
		end: Date
	): Promise<DailyPlannedCaloriesDao[]>;
	create(meal: NewPlannedMealDao): Promise<PlannedMealDao>;
	update(id: string, meal: UpdatePlannedMealDao): Promise<PlannedMealDao>;
	delete(id: string): Promise<void>;
}
