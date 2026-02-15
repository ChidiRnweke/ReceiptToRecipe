import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IPurchaseHistoryRepository } from './interfaces';
import type {
	PurchaseHistoryDao,
	NewPurchaseHistoryDao,
	UpdatePurchaseHistoryDao,
	SmartSuggestionDao
} from './daos';

export class PurchaseHistoryRepository implements IPurchaseHistoryRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<PurchaseHistoryDao | null> {
		const history = await this.db.query.purchaseHistory.findFirst({
			where: eq(schema.purchaseHistory.id, id)
		});
		return history ? this.toDao(history) : null;
	}

	async findByUserId(userId: string): Promise<PurchaseHistoryDao[]> {
		const history = await this.db.query.purchaseHistory.findMany({
			where: eq(schema.purchaseHistory.userId, userId),
			orderBy: [desc(schema.purchaseHistory.lastPurchased)]
		});
		return history.map((h) => this.toDao(h));
	}

	async findByUserAndItem(userId: string, itemName: string): Promise<PurchaseHistoryDao | null> {
		const history = await this.db.query.purchaseHistory.findFirst({
			where: and(
				eq(schema.purchaseHistory.userId, userId),
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

	async findSuggestions(userId: string, limit: number): Promise<SmartSuggestionDao[]> {
		const now = new Date();

		const history = await this.db.query.purchaseHistory.findMany({
			where: eq(schema.purchaseHistory.userId, userId),
			orderBy: [desc(schema.purchaseHistory.lastPurchased)]
		});

		const suggestions: SmartSuggestionDao[] = [];

		for (const item of history) {
			const daysSinceLastPurchase = Math.floor(
				(now.getTime() - item.lastPurchased.getTime()) / (1000 * 60 * 60 * 24)
			);

			if (item.avgFrequencyDays && daysSinceLastPurchase >= item.avgFrequencyDays * 0.8) {
				suggestions.push({
					itemName: item.itemName,
					lastPurchased: item.lastPurchased,
					avgFrequencyDays: item.avgFrequencyDays,
					daysSinceLastPurchase,
					suggestedQuantity: item.avgQuantity
				});
			}
		}

		// Sort by how "overdue" the item is
		return suggestions
			.sort((a, b) => {
				const aOverdue = a.avgFrequencyDays ? a.daysSinceLastPurchase / a.avgFrequencyDays : 0;
				const bOverdue = b.avgFrequencyDays ? b.daysSinceLastPurchase / b.avgFrequencyDays : 0;
				return bOverdue - aOverdue;
			})
			.slice(0, limit);
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

	async countActiveByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(schema.purchaseHistory)
			.where(
				and(eq(schema.purchaseHistory.userId, userId), eq(schema.purchaseHistory.isDepleted, false))
			);
		return result[0]?.count ?? 0;
	}

	private toDao(history: typeof schema.purchaseHistory.$inferSelect): PurchaseHistoryDao {
		return {
			id: history.id,
			userId: history.userId,
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
