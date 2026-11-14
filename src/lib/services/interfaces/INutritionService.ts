import type { MealLogDao } from '$repositories';
import type { Actor } from '$lib/models/household';

export interface NutritionDaySummary {
	date: string;
	goalCalories: number | null;
	consumedCalories: number;
	remainingCalories: number | null;
	adherencePercent: number | null;
	entries: MealLogDao[];
}

export interface NutritionWeekSummary {
	startDate: string;
	endDate: string;
	goalCalories: number | null;
	plannedCalories: number;
	consumedCalories: number;
	remainingCalories: number | null;
	adherencePercent: number | null;
	daily: Array<{
		date: string;
		plannedCalories: number;
		consumedCalories: number;
	}>;
}

export interface NutritionStreak {
	currentDays: number;
	bestDays: number;
	lastMetDate: string | null;
}

export interface NutritionAdherence {
	windowDays: number;
	daysOnTarget: number;
	totalTrackedDays: number;
	ratePercent: number;
}

export interface NutritionAggregates {
	today: NutritionDaySummary;
	week: NutritionWeekSummary;
	streak: NutritionStreak;
	adherence: NutritionAdherence;
}

export interface NutritionAggregateOptions {
	referenceDate?: Date;
	goalCalories?: number | null;
	adherenceWindowDays?: number;
	tolerancePercent?: number;
}

export interface INutritionService {
	getAggregates(actor: Actor, options?: NutritionAggregateOptions): Promise<NutritionAggregates>;
}
