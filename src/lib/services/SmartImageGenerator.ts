import { OpenRouter } from '@openrouter/sdk';
import type { IImageGenerator, GeneratedImage } from './interfaces';

/** Generates images through OpenRouter with an image-output model. */
export class SmartImageGenerator implements IImageGenerator {
	private client: OpenRouter;
	private model: string;

	constructor(apiKey: string, model: string = 'google/gemini-2.5-flash-image') {
		this.client = new OpenRouter({ apiKey });
		this.model = model;
	}

	async generateImage(prompt: string): Promise<GeneratedImage> {
		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				modalities: ['image'],
				stream: false
			}
		});

		if (!completion || !('choices' in completion) || completion.choices.length === 0) {
			throw new Error('Failed to generate image: no response choices');
		}

		const message = completion.choices[0].message;
		if (!message.images || message.images.length === 0) {
			throw new Error('Failed to generate image: no image in response');
		}

		return { url: message.images[0].imageUrl.url };
	}
}
