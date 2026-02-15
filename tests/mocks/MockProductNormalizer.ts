import type {
	IProductNormalizer,
	NormalizedProductInfo
} from '../../src/lib/services/interfaces/IProductNormalizer';

/**
 * Mock implementation of IProductNormalizer for testing
 */
export class MockProductNormalizer implements IProductNormalizer {
	private mocks = new Map<string, NormalizedProductInfo>();
	private defaultInfo: NormalizedProductInfo = {
		normalizedName: 'Unknown Product',
		productGroup: 'Other',
		category: 'other',
		isFoodItem: true
	};

	async normalizeProduct(rawName: string): Promise<NormalizedProductInfo> {
		const mockData = this.mocks.get(rawName);
		if (mockData) {
			// Ensure isFoodItem is always set, defaulting to true if not provided
			return {
				...mockData,
				isFoodItem: mockData.isFoodItem !== undefined ? mockData.isFoodItem : true
			};
		}
		return {
			...this.defaultInfo,
			normalizedName: rawName
		};
	}

	// Test helpers
	setMock(rawName: string, info: NormalizedProductInfo): void {
		this.mocks.set(rawName, info);
	}

	setDefaultInfo(info: NormalizedProductInfo): void {
		this.defaultInfo = info;
	}

	clear(): void {
		this.mocks.clear();
	}
}
