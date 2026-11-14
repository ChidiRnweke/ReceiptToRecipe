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
	findByHouseholdId(householdId: string, limit?: number): Promise<ReceiptDao[]>;
	findByHouseholdIdWithItems(householdId: string, limit?: number): Promise<ReceiptWithItemsDao[]>;
	/** Receipts of every household in the given states, oldest first. */
	findByStatuses(statuses: ReceiptDao['status'][]): Promise<ReceiptDao[]>;
	create(receipt: NewReceiptDao): Promise<ReceiptDao>;
	update(id: string, receipt: UpdateReceiptDao): Promise<ReceiptDao>;
	delete(id: string): Promise<void>;
	/**
	 * Marks the receipt's shop as counted. Returns true for the one call that set the mark, and
	 * false when an earlier reading of the receipt already set it.
	 */
	claimShopRecording(id: string, at: Date): Promise<boolean>;
	getStatus(id: string): Promise<ReceiptStatusDao | null>;
	countByHouseholdId(householdId: string): Promise<number>;
}

export interface IReceiptItemRepository {
	findById(id: string): Promise<import('../daos').ReceiptItemDao | null>;
	findByReceiptId(receiptId: string): Promise<import('../daos').ReceiptItemDao[]>;
	findByIdsInHousehold(
		ids: string[],
		householdId: string
	): Promise<import('../daos').ReceiptItemDao[]>;
	create(item: import('../daos').NewReceiptItemDao): Promise<import('../daos').ReceiptItemDao>;
	createMany(
		items: import('../daos').NewReceiptItemDao[]
	): Promise<import('../daos').ReceiptItemDao[]>;
	update(
		id: string,
		item: import('../daos').UpdateReceiptItemDao
	): Promise<import('../daos').ReceiptItemDao>;
	delete(id: string): Promise<void>;
	/** Replaces every line of the receipt with these, in one transaction. */
	replaceForReceipt(
		receiptId: string,
		items: import('../daos').NewReceiptItemDao[]
	): Promise<import('../daos').ReceiptItemDao[]>;
	findLatestByNormalizedName(
		householdId: string,
		normalizedName: string
	): Promise<
		| (import('../daos').ReceiptItemDao & {
				storeName: string | null;
				receiptId: string;
		  })
		| null
	>;
}
