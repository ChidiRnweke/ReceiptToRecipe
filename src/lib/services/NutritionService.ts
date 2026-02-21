import type {
	IMealLogRepository,
	IPlannedMealRepository,
	IUserPreferencesRepository,
	MealLogDao
} from '$repositories';
import type {
	INutritionService,
	NutritionAdherence,
	NutritionAggregateOptions,
	NutritionAggregates,
	NutritionDaySummary,
	NutritionStreak,
	NutritionWeekSummary
} from './interfaces/INutritionService';

const DEFAULT_ADHERENCE_WINDOW = 14;
const DEFAULT_TOLERANCE_PERCENT = 10;

export class NutritionService implements INutritionService {
	constructor(
		private mealLogRepo: IMealLogRepository,
		private plannedMealRepo: IPlannedMealRepository,
		private userPreferencesRepo: IUserPreferencesRepository
	) {}

	async getAggregates(
		userId: string,
		options: NutritionAggregateOptions = {}
	): Promise<NutritionAggregates> {
		const referenceDate = options.referenceDate ?? new Date();
		const goalCalories = await this.resolveCalorieGoal(userId, options.goalCalories);
		const tolerancePercent = options.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT;
		const adherenceWindowDays = options.adherenceWindowDays ?? DEFAULT_ADHERENCE_WINDOW;

		const today = await this.getDailySummary(userId, referenceDate, goalCalories);
		const week = await this.getWeeklySummary(userId, referenceDate, goalCalories);
		const streak = await this.getStreak(userId, referenceDate, goalCalories, tolerancePercent);
		const adherence = await this.getAdherence(
			userId,
			referenceDate,
			goalCalories,
			adherenceWindowDays,
			tolerancePercent
		);

		return {
			today,
			week,
			streak,
			adherence
		};
	}

	private async resolveCalorieGoal(
		userId: string,
		override?: number | null
	): Promise<number | null> {
		if (typeof override === 'number') {
			return override;
		}

		const prefs = await this.userPreferencesRepo.findByUserId(userId);
		return prefs?.caloricGoal ?? null;
	}

	private async getDailySummary(
		userId: string,
		date: Date,
		goalCalories: number | null
	): Promise<NutritionDaySummary> {
		const { start, end } = this.dayRange(date);
		const entries = await this.mealLogRepo.findByUserIdAndRange(userId, start, end);
		const consumedCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);

		return {
			date: this.toIsoDate(start),
			goalCalories,
			consumedCalories,
			remainingCalories: goalCalories === null ? null : goalCalories - consumedCalories,
			adherencePercent:
				goalCalories === null || goalCalories === 0
					? null
					: Math.round((consumedCalories / goalCalories) * 100),
			entries
		};
	}

	private async getWeeklySummary(
		userId: string,
		date: Date,
		goalCalories: number | null
	): Promise<NutritionWeekSummary> {
		const { start, end } = this.weekRange(date);
		const [consumedGrouped, plannedGrouped] = await Promise.all([
			this.mealLogRepo.findDailyCaloriesByUserIdAndRange(userId, start, end),
			this.plannedMealRepo.findDailyCaloriesByUserIdAndRange(userId, start, end)
		]);
		const consumedMap = new Map(consumedGrouped.map((day) => [day.date, day.calories]));
		const plannedMap = new Map(plannedGrouped.map((day) => [day.date, day.calories]));

		const daily: Array<{ date: string; plannedCalories: number; consumedCalories: number }> = [];
		for (let i = 0; i < 7; i++) {
			const current = new Date(start);
			current.setDate(start.getDate() + i);
			const key = this.toIsoDate(current);
			daily.push({
				date: key,
				plannedCalories: plannedMap.get(key) ?? 0,
				consumedCalories: consumedMap.get(key) ?? 0
			});
		}

		const plannedCalories = daily.reduce((sum, day) => sum + day.plannedCalories, 0);
		const consumedCalories = daily.reduce((sum, day) => sum + day.consumedCalories, 0);
		const weeklyGoal = goalCalories === null ? null : goalCalories * 7;

		return {
			startDate: this.toIsoDate(start),
			endDate: this.toIsoDate(end),
			goalCalories: weeklyGoal,
			plannedCalories,
			consumedCalories,
			remainingCalories: weeklyGoal === null ? null : weeklyGoal - consumedCalories,
			adherencePercent:
				weeklyGoal === null || weeklyGoal === 0
					? null
					: Math.round((consumedCalories / weeklyGoal) * 100),
			daily
		};
	}

	private async getStreak(
		userId: string,
		referenceDate: Date,
		goalCalories: number | null,
		tolerancePercent: number
	): Promise<NutritionStreak> {
		if (!goalCalories || goalCalories <= 0) {
			return { currentDays: 0, bestDays: 0, lastMetDate: null };
		}

		const firstLog = await this.mealLogRepo.findByUserId(userId, 1_000);
		if (firstLog.length === 0) {
			return { currentDays: 0, bestDays: 0, lastMetDate: null };
		}

		const oldest = firstLog[firstLog.length - 1]?.consumedAt ?? referenceDate;
		const { start, end } = {
			start: this.startOfDay(oldest),
			end: this.endOfDay(referenceDate)
		};

		const grouped = await this.mealLogRepo.findDailyCaloriesByUserIdAndRange(userId, start, end);
		const eligibleDates = new Set(
			grouped
				.filter((day) => this.isOnTarget(day.calories, goalCalories, tolerancePercent))
				.map((day) => day.date)
		);

		let currentDays = 0;
		let dayCursor = this.startOfDay(referenceDate);
		while (eligibleDates.has(this.toIsoDate(dayCursor))) {
			currentDays += 1;
			dayCursor.setDate(dayCursor.getDate() - 1);
		}

		const ordered = grouped
			.slice()
			.sort((a, b) => a.date.localeCompare(b.date))
			.filter((day) => day.calories > 0);

		let bestDays = 0;
		let running = 0;
		let previous: Date | null = null;
		let lastMetDate: string | null = null;

		for (const day of ordered) {
			const current = new Date(`${day.date}T00:00:00.000Z`);
			if (!this.isOnTarget(day.calories, goalCalories, tolerancePercent)) {
				running = 0;
				previous = current;
				continue;
			}

			if (!lastMetDate) {
				lastMetDate = day.date;
			} else {
				lastMetDate = day.date;
			}

			if (previous) {
				const diff = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
				running = diff === 1 ? running + 1 : 1;
			} else {
				running = 1;
			}

			bestDays = Math.max(bestDays, running);
			previous = current;
		}

		return {
			currentDays,
			bestDays,
			lastMetDate
		};
	}

	private async getAdherence(
		userId: string,
		referenceDate: Date,
		goalCalories: number | null,
		windowDays: number,
		tolerancePercent: number
	): Promise<NutritionAdherence> {
		if (!goalCalories || goalCalories <= 0) {
			return {
				windowDays,
				daysOnTarget: 0,
				totalTrackedDays: 0,
				ratePercent: 0
			};
		}

		const end = this.endOfDay(referenceDate);
		const start = this.startOfDay(referenceDate);
		start.setDate(start.getDate() - (windowDays - 1));

		const grouped = await this.mealLogRepo.findDailyCaloriesByUserIdAndRange(userId, start, end);
		const trackedDays = grouped.filter((day) => day.calories > 0);
		const daysOnTarget = trackedDays.filter((day) =>
			this.isOnTarget(day.calories, goalCalories, tolerancePercent)
		).length;

		const totalTrackedDays = trackedDays.length;
		return {
			windowDays,
			daysOnTarget,
			totalTrackedDays,
			ratePercent: totalTrackedDays === 0 ? 0 : Math.round((daysOnTarget / totalTrackedDays) * 100)
		};
	}

	private isOnTarget(calories: number, goalCalories: number, tolerancePercent: number): boolean {
		const tolerance = Math.round(goalCalories * (tolerancePercent / 100));
		return calories >= goalCalories - tolerance && calories <= goalCalories + tolerance;
	}

	private dayRange(date: Date): { start: Date; end: Date } {
		return {
			start: this.startOfDay(date),
			end: this.endOfDay(date)
		};
	}

	private weekRange(date: Date): { start: Date; end: Date } {
		const start = this.startOfDay(date);
		const day = start.getDay();
		const distanceToMonday = (day + 6) % 7;
		start.setDate(start.getDate() - distanceToMonday);

		const end = this.endOfDay(start);
		end.setDate(start.getDate() + 6);
		end.setHours(23, 59, 59, 999);

		return { start, end };
	}

	private startOfDay(date: Date): Date {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	private endOfDay(date: Date): Date {
		const d = new Date(date);
		d.setHours(23, 59, 59, 999);
		return d;
	}

	private toIsoDate(date: Date): string {
		return date.toISOString().slice(0, 10);
	}
}
