import type { RawReceiptData } from './IReceiptExtractor';

export interface Receipt {
	id: string;
	userId: string;
	imageUrl: string;
	status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	rawOcrData: Record<string, unknown> | null;
	storeName: string | null;
	purchaseDate: Date | null;
	totalAmount: string | null;
	currency: string | null;
	errorMessage: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ReceiptItem {
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

export interface ReceiptWithItems extends Receipt {
	items: ReceiptItem[];
}

export interface UploadReceiptInput {
	userId: string;
	file: File;
}

export interface UpdateReceiptItemInput {
	name: string;
	quantity: string;
	unit?: string;
	price?: string | null;
	category?: string | null;
}

export interface IReceiptService {
	uploadReceipt(input: UploadReceiptInput): Promise<Receipt>;
	getReceipt(receiptId: string, userId: string): Promise<ReceiptWithItems | null>;
	getReceiptStatus(
		receiptId: string,
		userId: string
	): Promise<{ status: string; errorMessage?: string | null } | null>;
	getUserReceipts(userId: string, limit?: number): Promise<ReceiptWithItems[]>;
	deleteReceipt(receiptId: string, userId: string): Promise<void>;
	updateReceiptItem(
		receiptId: string,
		userId: string,
		itemId: string,
		data: UpdateReceiptItemInput
	): Promise<ReceiptItem>;
	addManualItem(
		receiptId: string,
		userId: string,
		data: UpdateReceiptItemInput
	): Promise<ReceiptItem>;
	deleteReceiptItem(receiptId: string, userId: string, itemId: string): Promise<void>;
	getRecipeCountsByReceiptIds(receiptIds: string[]): Promise<Record<string, number>>;
}
