import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IPurchaseHistoryRepository } from './interfaces';
import type { PurchaseHistoryDao, NewPurchaseHistoryDao, UpdatePurchaseHistoryDao } from './daos';

export class PurchaseHistoryRepository implements IPurchaseHistoryRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<PurchaseHistoryDao | null> {
		const history = await this.db.query.purchaseHistory.findFirst({
			where: eq(schema.purchaseHistory.id, id)
		});
		return history ? this.toDao(history) : null;
	}

	async findByHouseholdId(householdId: string): Promise<PurchaseHistoryDao[]> {
		const history = await this.db.query.purchaseHistory.findMany({
			where: eq(schema.purchaseHistory.householdId, householdId),
			orderBy: [desc(schema.purchaseHistory.lastPurchased)]
		});
		return history.map((h) => this.toDao(h));
	}

	async findByHouseholdAndItem(
		householdId: string,
		itemName: string
	): Promise<PurchaseHistoryDao | null> {
		const history = await this.db.query.purchaseHistory.findFirst({
			where: and(
				eq(schema.purchaseHistory.householdId, householdId),
				eq(schema.purchaseHistory.itemName, itemName)
			)
		});
		return history ? this.toDao(history) : null;
	}

	async create(history: NewPurchaseHistoryDao): Promise<PurchaseHistoryDao> {
		const [created] = await this.db
			.insert(schema.purchaseHistory)
			.values({
				userId: history.userId,
				householdId: history.householdId,
				itemName: history.itemName,
				lastPurchased: history.lastPurchased,
				purchaseCount: history.purchaseCount ?? 1,
				avgQuantity: history.avgQuantity ?? null,
				avgFrequencyDays: history.avgFrequencyDays ?? null,
				estimatedDepleteDate: history.estimatedDepleteDate ?? null
			})
			.returning();
		return this.toDao(created);
	}

	async update(id: string, history: UpdatePurchaseHistoryDao): Promise<PurchaseHistoryDao> {
		const [updated] = await this.db
			.update(schema.purchaseHistory)
			.set({
				...history,
				updatedAt: new Date()
			})
			.where(eq(schema.purchaseHistory.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.purchaseHistory).where(eq(schema.purchaseHistory.id, id));
	}

	async markDepleted(id: string): Promise<PurchaseHistoryDao> {
		const [updated] = await this.db
			.update(schema.purchaseHistory)
			.set({
				isDepleted: true,
				updatedAt: new Date()
			})
			.where(eq(schema.purchaseHistory.id, id))
			.returning();
		return this.toDao(updated);
	}

	async clearDepleted(id: string): Promise<PurchaseHistoryDao> {
		const [updated] = await this.db
			.update(schema.purchaseHistory)
			.set({
				isDepleted: false,
				updatedAt: new Date()
			})
			.where(eq(schema.purchaseHistory.id, id))
			.returning();
		return this.toDao(updated);
	}

	async countActiveByHouseholdId(householdId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(schema.purchaseHistory)
			.where(
				and(
					eq(schema.purchaseHistory.householdId, householdId),
					eq(schema.purchaseHistory.isDepleted, false)
				)
			);
		return result[0]?.count ?? 0;
	}

	private toDao(history: typeof schema.purchaseHistory.$inferSelect): PurchaseHistoryDao {
		return {
			id: history.id,
			userId: history.userId,
			householdId: history.householdId,
			itemName: history.itemName,
			lastPurchased: history.lastPurchased,
			purchaseCount: history.purchaseCount,
			avgQuantity: history.avgQuantity,
			avgFrequencyDays: history.avgFrequencyDays,
			estimatedDepleteDate: history.estimatedDepleteDate,
			userOverrideDate: history.userOverrideDate,
			userShelfLifeDays: history.userShelfLifeDays,
			userQuantityOverride: history.userQuantityOverride,
			isDepleted: history.isDepleted,
			createdAt: history.createdAt,
			updatedAt: history.updatedAt
		};
	}
}
