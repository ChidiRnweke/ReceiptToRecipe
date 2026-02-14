import { OpenRouter } from '@openrouter/sdk';
import type { IProductNormalizer, NormalizedProductInfo } from './interfaces/IProductNormalizer';

const NORMALIZE_SYSTEM_PROMPT = `You are a product normalization expert for a grocery application. 
Your task is to analyze raw product names from receipts and extract structured information.

For each product, you should determine:
1. normalizedName: A clean, standard name for the product (e.g., "Coca Cola 33cl" -> "Cola", "Lays Chips Paprika" -> "Potato Chips"). Remove brand names unless they are essential to the product identity.
2. productGroup: A broad grouping for the product (e.g., "Soft Drinks", "Snacks", "Vegetables").
3. category: A high-level category (e.g., "beverages", "pantry", "produce", "dairy", "meat").

Always respond with valid JSON matching the requested format.`;

export class SmartProductNormalizer implements IProductNormalizer {
	private client: OpenRouter;
	private model: string;

	constructor(apiKey: string, model: string = 'google/gemini-3-flash-preview') {
		this.client = new OpenRouter({ apiKey });
		this.model = model;
	}

	async normalizeProduct(rawName: string): Promise<NormalizedProductInfo> {
		const prompt = `Normalize this product name: "${rawName}"

Respond with JSON:
{
  "normalizedName": "string",
  "productGroup": "string",
  "category": "string"
}`;

		try {
			const completion = await this.client.chat.send({
				chatGenerationParams: {
					model: this.model,
					messages: [
						{
							role: 'system',
							content: NORMALIZE_SYSTEM_PROMPT
						},
						{
							role: 'user',
							content: prompt
						}
					],
					responseFormat: { type: 'json_object' },
					stream: false
				}
			});

			if (!completion || !('choices' in completion)) {
				throw new Error('Invalid response from OpenRouter');
			}

			const content = completion.choices[0].message.content;
			let responseText = '';

			if (typeof content === 'string') {
				responseText = content;
			} else if (Array.isArray(content)) {
				responseText = content
					.filter((part) => part.type === 'text')
					.map((part) => (part as any).text)
					.join('');
			}

			if (!responseText) {
				throw new Error('Empty response from OpenRouter');
			}

			return JSON.parse(responseText) as NormalizedProductInfo;
		} catch (error) {
			console.error('Error normalizing product:', error);
			// Fallback
			return {
				normalizedName: rawName,
				productGroup: 'Other',
				category: 'other'
			};
		}
	}
}
