import type { IReceiptExtractor, RawReceiptData } from '../../src/lib/services/interfaces/IReceiptExtractor';

/**
 * Mock implementation of IReceiptExtractor for testing
 * Returns pre-configured mock data for specific image URLs
 */
export class MockReceiptExtractor implements IReceiptExtractor {
	private mocks = new Map<string, RawReceiptData>();
	private defaultData: RawReceiptData = { items: [] };

	async extractReceipt(imageUrl: string): Promise<RawReceiptData> {
		return this.mocks.get(imageUrl) || this.defaultData;
	}

	async extractReceiptFromBuffer(
		imageBuffer: Buffer,
		mimeType: string
	): Promise<RawReceiptData> {
		return this.defaultData;
	}

	// Test helpers
	setMock(imageUrl: string, data: RawReceiptData): void {
		this.mocks.set(imageUrl, data);
	}

	setDefaultData(data: RawReceiptData): void {
		this.defaultData = data;
	}

	clear(): void {
		this.mocks.clear();
		this.defaultData = { items: [] };
	}
}
