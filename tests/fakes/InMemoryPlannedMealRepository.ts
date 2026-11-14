import { v4 as uuid } from 'uuid';
import type { IPlannedMealRepository } from '../../src/lib/repositories/interfaces/IPlannedMealRepository';
import type {
	DailyPlannedCaloriesDao,
	NewPlannedMealDao,
	PlannedMealDao,
	UpdatePlannedMealDao
} from '../../src/lib/repositories/daos';

export class InMemoryPlannedMealRepository implements IPlannedMealRepository {
	private meals = new Map<string, PlannedMealDao>();

	async findById(id: string): Promise<PlannedMealDao | null> {
		return this.meals.get(id) ?? null;
	}

	async findByHouseholdId(householdId: string, limit = 100): Promise<PlannedMealDao[]> {
		return [...this.meals.values()]
			.filter((meal) => meal.householdId === householdId)
			.sort((a, b) => b.plannedDate.getTime() - a.plannedDate.getTime())
			.slice(0, limit);
	}

	async findByHouseholdIdAndRange(
		householdId: string,
		start: Date,
		end: Date
	): Promise<PlannedMealDao[]> {
		return (await this.findByHouseholdId(householdId, Number.MAX_SAFE_INTEGER)).filter(
			(meal) => meal.plannedDate >= start && meal.plannedDate <= end
		);
	}

	async deleteByHouseholdIdAndRange(householdId: string, start: Date, end: Date): Promise<void> {
		for (const meal of await this.findByHouseholdIdAndRange(householdId, start, end)) {
			this.meals.delete(meal.id);
		}
	}

	async findDailyCaloriesByHouseholdIdAndRange(
		householdId: string,
		start: Date,
		end: Date
	): Promise<DailyPlannedCaloriesDao[]> {
		const totals = new Map<string, number>();
		for (const meal of await this.findByHouseholdIdAndRange(householdId, start, end)) {
			const date = meal.plannedDate.toISOString().slice(0, 10);
			totals.set(date, (totals.get(date) ?? 0) + meal.plannedCalories);
		}
		return [...totals.entries()].map(([date, calories]) => ({ date, calories }));
	}

	async create(meal: NewPlannedMealDao): Promise<PlannedMealDao> {
		const now = new Date();
		const created: PlannedMealDao = {
			id: uuid(),
			userId: meal.userId,
			householdId: meal.householdId,
			recipeId: meal.recipeId ?? null,
			mealName: meal.mealName,
			plannedDate: meal.plannedDate,
			plannedCalories: meal.plannedCalories,
			mealType: meal.mealType,
			status: 'PLANNED',
			servings: meal.servings ?? null,
			createdAt: now,
			updatedAt: now
		};
		this.meals.set(created.id, created);
		return created;
	}

	async update(id: string, meal: UpdatePlannedMealDao): Promise<PlannedMealDao> {
		const existing = this.meals.get(id);
		if (!existing) throw new Error('Planned meal not found');
		const updated = { ...existing, ...meal, updatedAt: new Date() };
		this.meals.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.meals.delete(id);
	}
}
