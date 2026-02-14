import type { IReceiptExtractor, RawReceiptData } from './interfaces';

const MOCK_DATA: RawReceiptData = {
	items: [
		{
			name: 'chicken thighs',
			quantity: '2 lb',
			price: '$8.12',
			category: 'meat'
		},
		{
			name: 'asparagus bundle',
			quantity: '1',
			price: '$3.80',
			category: 'produce'
		},
		{
			name: 'yukon potatoes',
			quantity: '1kg',
			price: '$4.10',
			category: 'produce'
		}
	],
	storeName: 'Sample Market',
	purchaseDate: new Date().toISOString(),
	total: '$24.02'
};

export class MockOcrService implements IReceiptExtractor {
	async extractReceipt(): Promise<RawReceiptData> {
		return MOCK_DATA;
	}

	async extractReceiptFromBuffer(): Promise<RawReceiptData> {
		return MOCK_DATA;
	}
}
