import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IMealLogRepository } from './interfaces';
import type { DailyCaloriesDao, MealLogDao, NewMealLogDao, UpdateMealLogDao } from './daos';

export class MealLogRepository implements IMealLogRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<MealLogDao | null> {
		const log = await this.db.query.mealLogs.findFirst({
			where: eq(schema.mealLogs.id, id)
		});
		return log ? this.toDao(log) : null;
	}

	async findByUserId(userId: string, limit = 100): Promise<MealLogDao[]> {
		const logs = await this.db.query.mealLogs.findMany({
			where: eq(schema.mealLogs.userId, userId),
			orderBy: [desc(schema.mealLogs.consumedAt)],
			limit
		});

		return logs.map((log) => this.toDao(log));
	}

	async findByUserIdAndRange(userId: string, start: Date, end: Date): Promise<MealLogDao[]> {
		const logs = await this.db.query.mealLogs.findMany({
			where: and(
				eq(schema.mealLogs.userId, userId),
				gte(schema.mealLogs.consumedAt, start),
				lte(schema.mealLogs.consumedAt, end)
			),
			orderBy: [desc(schema.mealLogs.consumedAt)]
		});

		return logs.map((log) => this.toDao(log));
	}

	async findDailyCaloriesByUserIdAndRange(
		userId: string,
		start: Date,
		end: Date
	): Promise<DailyCaloriesDao[]> {
		const rows = await this.db
			.select({
				date: sql<string>`date(${schema.mealLogs.consumedAt})::text`,
				calories: sql<number>`coalesce(sum(${schema.mealLogs.calories}), 0)::int`
			})
			.from(schema.mealLogs)
			.where(
				and(
					eq(schema.mealLogs.userId, userId),
					gte(schema.mealLogs.consumedAt, start),
					lte(schema.mealLogs.consumedAt, end)
				)
			)
			.groupBy(sql`date(${schema.mealLogs.consumedAt})`)
			.orderBy(sql`date(${schema.mealLogs.consumedAt}) desc`);

		return rows;
	}

	async create(log: NewMealLogDao): Promise<MealLogDao> {
		const [created] = await this.db
			.insert(schema.mealLogs)
			.values({
				userId: log.userId,
				recipeId: log.recipeId ?? null,
				foodName: log.foodName,
				calories: log.calories,
				consumedAt: log.consumedAt ?? new Date(),
				mealType: log.mealType
			})
			.returning();

		return this.toDao(created);
	}

	async update(id: string, log: UpdateMealLogDao): Promise<MealLogDao> {
		const [updated] = await this.db
			.update(schema.mealLogs)
			.set({
				...log,
				updatedAt: new Date()
			})
			.where(eq(schema.mealLogs.id, id))
			.returning();

		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.mealLogs).where(eq(schema.mealLogs.id, id));
	}

	async countByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(schema.mealLogs)
			.where(eq(schema.mealLogs.userId, userId));

		return result[0]?.count ?? 0;
	}

	private toDao(log: typeof schema.mealLogs.$inferSelect): MealLogDao {
		return {
			id: log.id,
			userId: log.userId,
			recipeId: log.recipeId,
			foodName: log.foodName,
			calories: log.calories,
			consumedAt: log.consumedAt,
			mealType: log.mealType,
			createdAt: log.createdAt,
			updatedAt: log.updatedAt
		};
	}
}
