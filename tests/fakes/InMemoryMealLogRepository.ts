import { v4 as uuid } from 'uuid';
import type { IMealLogRepository } from '../../src/lib/repositories/interfaces/IMealLogRepository';
import type {
	DailyCaloriesDao,
	MealLogDao,
	NewMealLogDao,
	UpdateMealLogDao
} from '../../src/lib/repositories/daos';

export class InMemoryMealLogRepository implements IMealLogRepository {
	private logs = new Map<string, MealLogDao>();

	async findById(id: string): Promise<MealLogDao | null> {
		return this.logs.get(id) ?? null;
	}

	async findByUserId(userId: string, limit = 100): Promise<MealLogDao[]> {
		return [...this.logs.values()]
			.filter((log) => log.userId === userId)
			.sort((a, b) => b.consumedAt.getTime() - a.consumedAt.getTime())
			.slice(0, limit);
	}

	async findByUserIdAndRange(userId: string, start: Date, end: Date): Promise<MealLogDao[]> {
		return (await this.findByUserId(userId, Number.MAX_SAFE_INTEGER)).filter(
			(log) => log.consumedAt >= start && log.consumedAt <= end
		);
	}

	async findDailyCaloriesByUserIdAndRange(
		userId: string,
		start: Date,
		end: Date
	): Promise<DailyCaloriesDao[]> {
		const totals = new Map<string, number>();
		for (const log of await this.findByUserIdAndRange(userId, start, end)) {
			const date = log.consumedAt.toISOString().slice(0, 10);
			totals.set(date, (totals.get(date) ?? 0) + log.calories);
		}
		return [...totals.entries()].map(([date, calories]) => ({ date, calories }));
	}

	async create(log: NewMealLogDao): Promise<MealLogDao> {
		const now = new Date();
		const created: MealLogDao = {
			id: uuid(),
			userId: log.userId,
			recipeId: log.recipeId ?? null,
			foodName: log.foodName,
			calories: log.calories,
			consumedAt: log.consumedAt ?? now,
			mealType: log.mealType,
			createdAt: now,
			updatedAt: now
		};
		this.logs.set(created.id, created);
		return created;
	}

	async update(id: string, log: UpdateMealLogDao): Promise<MealLogDao> {
		const existing = this.logs.get(id);
		if (!existing) throw new Error('Meal log not found');
		const updated = { ...existing, ...log, updatedAt: new Date() };
		this.logs.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.logs.delete(id);
	}

	async countByUserId(userId: string): Promise<number> {
		return (await this.findByUserId(userId, Number.MAX_SAFE_INTEGER)).length;
	}
}
