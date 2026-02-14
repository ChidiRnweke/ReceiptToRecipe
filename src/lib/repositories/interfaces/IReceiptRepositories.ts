import type {
	ReceiptDao,
	NewReceiptDao,
	UpdateReceiptDao,
	ReceiptWithItemsDao,
	ReceiptStatusDao
} from '../daos';

export interface IReceiptRepository {
	findById(id: string): Promise<ReceiptDao | null>;
	findByIdWithItems(id: string): Promise<ReceiptWithItemsDao | null>;
	findByUserId(userId: string, limit?: number): Promise<ReceiptDao[]>;
	findByUserIdWithItems(userId: string, limit?: number): Promise<ReceiptWithItemsDao[]>;
	create(receipt: NewReceiptDao): Promise<ReceiptDao>;
	update(id: string, receipt: UpdateReceiptDao): Promise<ReceiptDao>;
	delete(id: string): Promise<void>;
	getStatus(id: string): Promise<ReceiptStatusDao | null>;
	countByUserId(userId: string): Promise<number>;
}

export interface IReceiptItemRepository {
	findById(id: string): Promise<import('../daos').ReceiptItemDao | null>;
	findByReceiptId(receiptId: string): Promise<import('../daos').ReceiptItemDao[]>;
	create(item: import('../daos').NewReceiptItemDao): Promise<import('../daos').ReceiptItemDao>;
	createMany(
		items: import('../daos').NewReceiptItemDao[]
	): Promise<import('../daos').ReceiptItemDao[]>;
	update(
		id: string,
		item: import('../daos').UpdateReceiptItemDao
	): Promise<import('../daos').ReceiptItemDao>;
	delete(id: string): Promise<void>;
	findLatestByNormalizedName(
		userId: string,
		normalizedName: string
	): Promise<
		| (import('../daos').ReceiptItemDao & {
				storeName: string | null;
				receiptId: string;
		  })
		| null
	>;
}
