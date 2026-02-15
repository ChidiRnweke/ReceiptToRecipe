import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { ICupboardItemRepository } from './interfaces';
import type { CupboardItemDao, NewCupboardItemDao, UpdateCupboardItemDao } from './daos';

export class CupboardItemRepository implements ICupboardItemRepository {
	constructor(private db: Database) {}

	async findByUserId(userId: string): Promise<CupboardItemDao[]> {
		const items = await this.db.query.cupboardItems.findMany({
			where: and(
				eq(schema.cupboardItems.userId, userId),
				eq(schema.cupboardItems.isDepleted, false)
			),
			orderBy: [desc(schema.cupboardItems.addedDate)]
		});
		return items.map((item) => this.toDao(item));
	}

	async findById(id: string): Promise<CupboardItemDao | null> {
		const item = await this.db.query.cupboardItems.findFirst({
			where: eq(schema.cupboardItems.id, id)
		});
		return item ? this.toDao(item) : null;
	}

	async findByUserAndItem(userId: string, itemName: string): Promise<CupboardItemDao | null> {
		const item = await this.db.query.cupboardItems.findFirst({
			where: and(
				eq(schema.cupboardItems.userId, userId),
				eq(schema.cupboardItems.itemName, itemName),
				eq(schema.cupboardItems.isDepleted, false)
			)
		});
		return item ? this.toDao(item) : null;
	}

	async create(item: NewCupboardItemDao): Promise<CupboardItemDao> {
		const [created] = await this.db
			.insert(schema.cupboardItems)
			.values({
				userId: item.userId,
				itemName: item.itemName,
				quantity: item.quantity ?? null,
				unit: item.unit ?? null,
				category: item.category ?? null,
				addedDate: item.addedDate ?? new Date(),
				shelfLifeDays: item.shelfLifeDays ?? null,
				notes: item.notes ?? null
			})
			.returning();
		return this.toDao(created);
	}

	async update(id: string, data: UpdateCupboardItemDao): Promise<CupboardItemDao> {
		const [updated] = await this.db
			.update(schema.cupboardItems)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(schema.cupboardItems.id, id))
			.returning();
		return this.toDao(updated);
	}

	async markDepleted(id: string): Promise<CupboardItemDao> {
		const [updated] = await this.db
			.update(schema.cupboardItems)
			.set({
				isDepleted: true,
				updatedAt: new Date()
			})
			.where(eq(schema.cupboardItems.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.cupboardItems).where(eq(schema.cupboardItems.id, id));
	}

	async countByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(schema.cupboardItems)
			.where(
				and(eq(schema.cupboardItems.userId, userId), eq(schema.cupboardItems.isDepleted, false))
			);
		return result[0]?.count ?? 0;
	}

	private toDao(item: typeof schema.cupboardItems.$inferSelect): CupboardItemDao {
		return {
			id: item.id,
			userId: item.userId,
			itemName: item.itemName,
			quantity: item.quantity,
			unit: item.unit,
			category: item.category,
			addedDate: item.addedDate,
			shelfLifeDays: item.shelfLifeDays,
			isDepleted: item.isDepleted,
			notes: item.notes,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		};
	}
}
