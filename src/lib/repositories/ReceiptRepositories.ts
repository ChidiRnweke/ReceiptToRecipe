import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IReceiptRepository, IReceiptItemRepository } from './interfaces';
import type { ReceiptDao, NewReceiptDao, UpdateReceiptDao, ReceiptWithItemsDao, ReceiptStatusDao, ReceiptItemDao, NewReceiptItemDao, UpdateReceiptItemDao } from './daos';

export class ReceiptRepository implements IReceiptRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<ReceiptDao | null> {
		const receipt = await this.db.query.receipts.findFirst({
			where: eq(schema.receipts.id, id)
		});
		return receipt ? this.toDao(receipt) : null;
	}

	async findByIdWithItems(id: string): Promise<ReceiptWithItemsDao | null> {
		const receipt = await this.db.query.receipts.findFirst({
			where: eq(schema.receipts.id, id),
			with: { items: true }
		});

		if (!receipt) return null;

		return {
			...this.toDao(receipt),
			items: receipt.items.map(item => this.itemRepo.toDao(item))
		};
	}

	async findByUserId(userId: string, limit = 20): Promise<ReceiptDao[]> {
		const receipts = await this.db.query.receipts.findMany({
			where: eq(schema.receipts.userId, userId),
			orderBy: [desc(schema.receipts.createdAt)],
			limit
		});
		return receipts.map(r => this.toDao(r));
	}

	async findByUserIdWithItems(userId: string, limit = 20): Promise<ReceiptWithItemsDao[]> {
		const receipts = await this.db.query.receipts.findMany({
			where: eq(schema.receipts.userId, userId),
			orderBy: [desc(schema.receipts.createdAt)],
			limit,
			with: { items: true }
		});

		return receipts.map(r => ({
			...this.toDao(r),
			items: r.items.map(item => this.itemRepo.toDao(item))
		}));
	}

	async create(receipt: NewReceiptDao): Promise<ReceiptDao> {
		const [created] = await this.db.insert(schema.receipts).values({
			userId: receipt.userId,
			imageUrl: receipt.imageUrl,
			status: receipt.status || 'QUEUED',
			storeName: receipt.storeName || null,
			purchaseDate: receipt.purchaseDate || null,
			totalAmount: receipt.totalAmount || null,
			currency: receipt.currency || 'USD'
		}).returning();
		return this.toDao(created);
	}

	async update(id: string, receipt: UpdateReceiptDao): Promise<ReceiptDao> {
		const [updated] = await this.db.update(schema.receipts)
			.set({
				...receipt,
				updatedAt: new Date()
			})
			.where(eq(schema.receipts.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.receipts).where(eq(schema.receipts.id, id));
	}

	async getStatus(id: string): Promise<ReceiptStatusDao | null> {
		const receipt = await this.db.query.receipts.findFirst({
			where: eq(schema.receipts.id, id),
			columns: { status: true, errorMessage: true }
		});

		return receipt ? {
			status: receipt.status,
			errorMessage: receipt.errorMessage
		} : null;
	}

	async countByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(schema.receipts)
			.where(eq(schema.receipts.userId, userId));

		return result[0]?.count || 0;
	}

	private toDao(receipt: typeof schema.receipts.$inferSelect): ReceiptDao {
		return {
			id: receipt.id,
			userId: receipt.userId,
			imageUrl: receipt.imageUrl,
			status: receipt.status as 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED',
			rawOcrData: receipt.rawOcrData as Record<string, unknown> | null,
			storeName: receipt.storeName,
			purchaseDate: receipt.purchaseDate,
			totalAmount: receipt.totalAmount,
			currency: receipt.currency ?? 'USD',
			errorMessage: receipt.errorMessage,
			createdAt: receipt.createdAt,
			updatedAt: receipt.updatedAt
		};
	}

	private get itemRepo() {
		return new ReceiptItemRepository(this.db);
	}
}

export class ReceiptItemRepository implements IReceiptItemRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<ReceiptItemDao | null> {
		const item = await this.db.query.receiptItems.findFirst({
			where: eq(schema.receiptItems.id, id)
		});
		return item ? this.toDao(item) : null;
	}

	async findByReceiptId(receiptId: string): Promise<ReceiptItemDao[]> {
		const items = await this.db.query.receiptItems.findMany({
			where: eq(schema.receiptItems.receiptId, receiptId),
			orderBy: [desc(schema.receiptItems.createdAt)]
		});
		return items.map(i => this.toDao(i));
	}

	async create(item: NewReceiptItemDao): Promise<ReceiptItemDao> {
		const [created] = await this.db.insert(schema.receiptItems).values({
			receiptId: item.receiptId,
			rawName: item.rawName,
			normalizedName: item.normalizedName,
			quantity: item.quantity,
			unit: item.unit,
			unitType: item.unitType,
			price: item.price || null,
			category: item.category || null,
			productGroup: item.productGroup || null
		}).returning();
		return this.toDao(created);
	}

	async createMany(items: NewReceiptItemDao[]): Promise<ReceiptItemDao[]> {
		if (items.length === 0) return [];
		const created = await this.db.insert(schema.receiptItems).values(items).returning();
		return created.map(i => this.toDao(i));
	}

	async update(id: string, item: UpdateReceiptItemDao): Promise<ReceiptItemDao> {
		const [updated] = await this.db.update(schema.receiptItems)
			.set(item)
			.where(eq(schema.receiptItems.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.receiptItems).where(eq(schema.receiptItems.id, id));
	}

	async findLatestByNormalizedName(userId: string, normalizedName: string): Promise<(ReceiptItemDao & { storeName: string | null; receiptId: string }) | null> {
		const result = await this.db
			.select({
				item: schema.receiptItems,
				storeName: schema.receipts.storeName,
				receiptId: schema.receipts.id
			})
			.from(schema.receiptItems)
			.innerJoin(schema.receipts, eq(schema.receipts.id, schema.receiptItems.receiptId))
			.where(and(
				eq(schema.receipts.userId, userId),
				eq(schema.receiptItems.normalizedName, normalizedName)
			))
			.orderBy(desc(schema.receiptItems.createdAt))
			.limit(1);

		if (result.length === 0) return null;

		return {
			...this.toDao(result[0].item),
			storeName: result[0].storeName,
			receiptId: result[0].receiptId
		};
	}

	toDao(item: typeof schema.receiptItems.$inferSelect): ReceiptItemDao {
		return {
			id: item.id,
			receiptId: item.receiptId,
			rawName: item.rawName,
			normalizedName: item.normalizedName,
			quantity: item.quantity,
			unit: item.unit,
			unitType: item.unitType as 'WEIGHT' | 'VOLUME' | 'COUNT',
			price: item.price,
			category: item.category,
			productGroup: item.productGroup,
			createdAt: item.createdAt
		};
	}
}
