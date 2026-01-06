import { Mistral } from '@mistralai/mistralai';
import type { IOcrService, RawReceiptData, RawReceiptItem } from './interfaces';

const RECEIPT_SCHEMA = {
	type: 'object',
	properties: {
		storeName: { type: 'string', description: 'Name of the store' },
		storeAddress: { type: 'string', description: 'Address of the store' },
		purchaseDate: { type: 'string', description: 'Date of purchase in ISO format (YYYY-MM-DD)' },
		items: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Name of the item' },
					quantity: { type: 'string', description: 'Quantity with unit (e.g., "2 lbs", "500g", "1")' },
					price: { type: 'string', description: 'Price of the item' },
					category: {
						type: 'string',
						description: 'Category of the item',
						enum: [
							'produce',
							'meat',
							'seafood',
							'dairy',
							'bakery',
							'frozen',
							'pantry',
							'beverages',
							'snacks',
							'household',
							'other'
						]
					}
				},
				required: ['name']
			}
		},
		subtotal: { type: 'string', description: 'Subtotal before tax' },
		tax: { type: 'string', description: 'Tax amount' },
		total: { type: 'string', description: 'Total amount' },
		paymentMethod: { type: 'string', description: 'Payment method used' }
	},
	required: ['items']
};

export class MistralOcrService implements IOcrService {
	private client: Mistral;

	constructor(apiKey: string) {
		this.client = new Mistral({ apiKey });
	}

	async extractReceipt(imageUrl: string): Promise<RawReceiptData> {
		const response = await this.client.chat.complete({
			model: 'pixtral-12b-2409',
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `Analyze this receipt image and extract the following information in JSON format:
- Store name and address
- Purchase date
- List of items with their names, quantities (include unit if visible), prices, and category
- Subtotal, tax, and total
- Payment method

Focus on food/grocery items. For each item, try to identify if it has a quantity and unit (like "2 lbs" or "500g").
If a quantity is not visible, assume 1 count.`
						},
						{
							type: 'image_url',
							imageUrl: imageUrl
						}
					]
				}
			],
			responseFormat: {
				type: 'json_schema',
				jsonSchema: {
					name: 'receipt_data',
					schemaDefinition: RECEIPT_SCHEMA
				}
			}
		});

		const content = response.choices?.[0]?.message?.content;
		if (!content || typeof content !== 'string') {
			throw new Error('Failed to extract receipt data');
		}

		const data = JSON.parse(content) as RawReceiptData;
		return this.validateAndClean(data);
	}

	async extractReceiptFromBuffer(imageBuffer: Buffer, mimeType: string): Promise<RawReceiptData> {
		const base64 = imageBuffer.toString('base64');
		const dataUrl = `data:${mimeType};base64,${base64}`;

		const response = await this.client.chat.complete({
			model: 'pixtral-12b-2409',
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `Analyze this receipt image and extract the following information in JSON format:
- Store name and address
- Purchase date
- List of items with their names, quantities (include unit if visible), prices, and category
- Subtotal, tax, and total
- Payment method

Focus on food/grocery items. For each item, try to identify if it has a quantity and unit (like "2 lbs" or "500g").
If a quantity is not visible, assume 1 count.`
						},
						{
							type: 'image_url',
							imageUrl: dataUrl
						}
					]
				}
			],
			responseFormat: {
				type: 'json_schema',
				jsonSchema: {
					name: 'receipt_data',
					schemaDefinition: RECEIPT_SCHEMA
				}
			}
		});

		const content = response.choices?.[0]?.message?.content;
		if (!content || typeof content !== 'string') {
			throw new Error('Failed to extract receipt data');
		}

		const data = JSON.parse(content) as RawReceiptData;
		return this.validateAndClean(data);
	}

	private validateAndClean(data: RawReceiptData): RawReceiptData {
		// Ensure items array exists
		if (!data.items || !Array.isArray(data.items)) {
			data.items = [];
		}

		// Clean up items
		data.items = data.items
			.filter((item: RawReceiptItem) => item.name && item.name.trim().length > 0)
			.map((item: RawReceiptItem) => ({
				name: item.name.trim(),
				quantity: item.quantity?.trim() || '1',
				price: item.price?.trim(),
				category: item.category || 'other'
			}));

		return data;
	}
}
