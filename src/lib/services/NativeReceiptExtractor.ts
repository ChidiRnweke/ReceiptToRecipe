import type { IReceiptExtractor, RawReceiptData } from './interfaces';
import { readFile } from 'fs/promises';
import { join } from 'path';

const RECEIPT_JSON_SCHEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'receipt_extraction',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				storeName: {
					type: 'string',
					description:
						"The name of the store or merchant. Identify the most plausible store name (e.g. from the logo or header). Focus on trying to find the name of grocery stores, supermarkets, or convenience stores. Don't look for random text that is not the store name."
				},
				purchaseDate: {
					type: 'string',
					description: 'The date of purchase (YYYY-MM-DD)'
				},
				currency: {
					type: 'string',
					description:
						'The currency symbol or code used in the receipt (e.g. EUR, USD, GBP, €). Default to EUR if unsure but looks European.'
				},
				items: {
					type: 'array',
					description: 'List of all line items purchased on the receipt',
					items: {
						type: 'object',
						properties: {
							name: {
								type: 'string',
								description: 'The name or description of the product item'
							},
							quantity: {
								type: 'string',
								description:
									"The count or weight of the item. Use '.' as decimal separator (e.g. 1.0, 2.5)."
							},
							price: {
								type: 'string',
								description:
									"The total price for this item line. Use '.' as decimal separator (e.g. 15.57)."
							},
							category: {
								type: 'string',
								description: 'The general category of the item (e.g. groceries, meat, vegetable)'
							}
						},
						required: ['name'],
						additionalProperties: false
					}
				},
				total: {
					type: 'string',
					description: "The total amount paid for the receipt. Use '.' as decimal separator."
				}
			},
			required: ['items', 'currency'],
			additionalProperties: false
		}
	}
};

export class NativeReceiptExtractor implements IReceiptExtractor {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async extractReceipt(imageUrl: string): Promise<RawReceiptData> {
		const isUrl = imageUrl.startsWith('http');
		const dataUrl = isUrl ? imageUrl : await this.getLocalAsBase64(imageUrl);

		const document = {
			type: 'image_url',
			image_url: dataUrl
		};

		return this.processOcrRequest(document);
	}

	async extractReceiptFromBuffer(imageBuffer: Buffer, mimeType: string): Promise<RawReceiptData> {
		const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

		const document = {
			type: 'image_url',
			image_url: dataUrl
		};

		return this.processOcrRequest(document);
	}

	private async processOcrRequest(document: any): Promise<RawReceiptData> {
		const response = await fetch('https://api.mistral.ai/v1/ocr', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`
			},
			body: JSON.stringify({
				model: 'mistral-ocr-latest',
				document: document,
				document_annotation_format: RECEIPT_JSON_SCHEMA,
				include_image_base64: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Mistral OCR API failed with status ${response.status}: ${errorText}`);
		}

		const result = await response.json();

		// Using 'any' to bypass strict type checking for the raw API response
		const data: any = result;

		const annotation = data.document_annotation || data.documentAnnotation;

		if (!annotation) {
			throw new Error('OCR failed: No annotation in response: ' + JSON.stringify(data));
		}

		return typeof annotation === 'string' ? JSON.parse(annotation) : annotation;
	}

	private async getLocalAsBase64(url: string): Promise<string> {
		const path = join(process.cwd(), 'static', url.replace(/^\//, ''));
		const buffer = await readFile(path);
		const ext = path.split('.').pop()?.toLowerCase() || 'jpg';
		return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${buffer.toString('base64')}`;
	}
}
