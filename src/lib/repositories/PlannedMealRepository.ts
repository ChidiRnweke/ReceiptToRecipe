import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IPlannedMealRepository } from './interfaces';
import type {
	DailyPlannedCaloriesDao,
	NewPlannedMealDao,
	PlannedMealDao,
	UpdatePlannedMealDao
} from './daos';

export class PlannedMealRepository implements IPlannedMealRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<PlannedMealDao | null> {
		const meal = await this.db.query.plannedMeals.findFirst({
			where: eq(schema.plannedMeals.id, id)
		});
		return meal ? this.toDao(meal) : null;
	}

	async findByUserId(userId: string, limit = 100): Promise<PlannedMealDao[]> {
		const meals = await this.db.query.plannedMeals.findMany({
			where: eq(schema.plannedMeals.userId, userId),
			orderBy: [desc(schema.plannedMeals.plannedDate)],
			limit
		});

		return meals.map((meal) => this.toDao(meal));
	}

	async findByUserIdAndRange(userId: string, start: Date, end: Date): Promise<PlannedMealDao[]> {
		const meals = await this.db.query.plannedMeals.findMany({
			where: and(
				eq(schema.plannedMeals.userId, userId),
				gte(schema.plannedMeals.plannedDate, start),
				lte(schema.plannedMeals.plannedDate, end)
			),
			orderBy: [desc(schema.plannedMeals.plannedDate)]
		});

		return meals.map((meal) => this.toDao(meal));
	}

	async deleteByUserIdAndRange(userId: string, start: Date, end: Date): Promise<void> {
		await this.db
			.delete(schema.plannedMeals)
			.where(
				and(
					eq(schema.plannedMeals.userId, userId),
					gte(schema.plannedMeals.plannedDate, start),
					lte(schema.plannedMeals.plannedDate, end)
				)
			);
	}

	async findDailyCaloriesByUserIdAndRange(
		userId: string,
		start: Date,
		end: Date
	): Promise<DailyPlannedCaloriesDao[]> {
		const rows = await this.db
			.select({
				date: sql<string>`date(${schema.plannedMeals.plannedDate})::text`,
				calories: sql<number>`coalesce(sum(${schema.plannedMeals.plannedCalories}), 0)::int`
			})
			.from(schema.plannedMeals)
			.where(
				and(
					eq(schema.plannedMeals.userId, userId),
					gte(schema.plannedMeals.plannedDate, start),
					lte(schema.plannedMeals.plannedDate, end)
				)
			)
			.groupBy(sql`date(${schema.plannedMeals.plannedDate})`)
			.orderBy(sql`date(${schema.plannedMeals.plannedDate}) desc`);

		return rows;
	}

	async create(meal: NewPlannedMealDao): Promise<PlannedMealDao> {
		const [created] = await this.db
			.insert(schema.plannedMeals)
			.values({
				userId: meal.userId,
				recipeId: meal.recipeId ?? null,
				mealName: meal.mealName,
				plannedDate: meal.plannedDate,
				plannedCalories: meal.plannedCalories,
				mealType: meal.mealType
			})
			.returning();

		return this.toDao(created);
	}

	async update(id: string, meal: UpdatePlannedMealDao): Promise<PlannedMealDao> {
		const [updated] = await this.db
			.update(schema.plannedMeals)
			.set({
				...meal,
				updatedAt: new Date()
			})
			.where(eq(schema.plannedMeals.id, id))
			.returning();

		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.plannedMeals).where(eq(schema.plannedMeals.id, id));
	}

	private toDao(meal: typeof schema.plannedMeals.$inferSelect): PlannedMealDao {
		return {
			id: meal.id,
			userId: meal.userId,
			recipeId: meal.recipeId,
			mealName: meal.mealName,
			plannedDate: meal.plannedDate,
			plannedCalories: meal.plannedCalories,
			mealType: meal.mealType,
			createdAt: meal.createdAt,
			updatedAt: meal.updatedAt
		};
	}
}
