import OpenAI from 'openai';
import type { IImageGenService, GeneratedImage } from './interfaces';

export class DalleImageService implements IImageGenService {
	private client: OpenAI;

	constructor(apiKey: string) {
		this.client = new OpenAI({ apiKey });
	}

	async generateImage(
		prompt: string,
		size: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'
	): Promise<GeneratedImage> {
		const response = await this.client.images.generate({
			model: 'dall-e-3',
			prompt,
			n: 1,
			size,
			quality: 'standard',
			style: 'natural'
		});

		const image = response.data[0];
		if (!image.url) {
			throw new Error('Failed to generate image');
		}

		return {
			url: image.url,
			revisedPrompt: image.revised_prompt
		};
	}

	async generateRecipeImage(
		recipeTitle: string,
		description?: string,
		ingredients?: string[]
	): Promise<GeneratedImage> {
		// Build an optimized prompt for food photography
		const parts: string[] = [
			'Professional food photography of',
			recipeTitle
		];

		if (description) {
			parts.push(`- ${description}`);
		}

		if (ingredients?.length) {
			const mainIngredients = ingredients.slice(0, 3).join(', ');
			parts.push(`featuring ${mainIngredients}`);
		}

		parts.push(
			'Styled on a rustic wooden table with natural lighting.',
			'Warm, inviting colors. Shallow depth of field.',
			'High-end restaurant presentation.',
			'No text or watermarks.'
		);

		const prompt = parts.join('. ');

		return this.generateImage(prompt);
	}
}
