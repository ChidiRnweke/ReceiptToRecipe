/** A shopping list item as it stood when its receipt was snapped. */
export interface ReceiptListItemDao {
	id: string;
	name: string;
	itemKey: string;
}

export interface ReceiptDao {
	id: string;
	userId: string;
	householdId: string;
	imageUrl: string;
	status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	rawOcrData: Record<string, unknown> | null;
	storeName: string | null;
	purchaseDate: Date | null;
	totalAmount: string | null;
	currency: string | null;
	errorMessage: string | null;
	/** When the OCR job counted this receipt's shop. Null until then. */
	shopRecordedAt: Date | null;
	/** The open list items when the receipt was snapped on the Shop door, else null. */
	listSnapshot: ReceiptListItemDao[] | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewReceiptDao {
	userId: string;
	householdId: string;
	imageUrl: string;
	status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	storeName?: string | null;
	purchaseDate?: Date | null;
	totalAmount?: string | null;
	currency?: string;
	listSnapshot?: ReceiptListItemDao[] | null;
}

export interface UpdateReceiptDao {
	status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	rawOcrData?: Record<string, unknown> | null;
	storeName?: string | null;
	purchaseDate?: Date | null;
	totalAmount?: string | null;
	currency?: string;
	errorMessage?: string | null;
}

export interface ReceiptItemDao {
	id: string;
	receiptId: string;
	rawName: string;
	normalizedName: string;
	quantity: string;
	unit: string;
	unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	price: string | null;
	category: string | null;
	productGroup: string | null;
	createdAt: Date;
}

export interface NewReceiptItemDao {
	receiptId: string;
	rawName: string;
	normalizedName: string;
	quantity: string;
	unit: string;
	unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	price?: string | null;
	category?: string | null;
	productGroup?: string | null;
}

export interface UpdateReceiptItemDao {
	rawName?: string;
	normalizedName?: string;
	quantity?: string;
	unit?: string;
	unitType?: 'WEIGHT' | 'VOLUME' | 'COUNT';
	price?: string | null;
	category?: string | null;
}

export interface ReceiptWithItemsDao extends ReceiptDao {
	items: ReceiptItemDao[];
}

export interface ReceiptStatusDao {
	status: string;
	errorMessage: string | null;
}
