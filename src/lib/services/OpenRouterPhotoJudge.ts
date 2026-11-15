import { OpenRouter } from '@openrouter/sdk';
import { z } from 'zod';
import type { PhotoBytes, PictureSubject } from '$lib/models/recipes';
import type { IPhotoJudge, PhotoScore } from './interfaces/IPhotoJudge';
import { photoJudgePrompt } from './recipes/pictureStyle';

const photoScoreSchema = z.object({
	score: z.coerce.number().int().min(1).max(5),
	reason: z.string().default('')
});

/** Scores a photo with one vision call through OpenRouter. */
export class OpenRouterPhotoJudge implements IPhotoJudge {
	private client: OpenRouter;

	constructor(
		apiKey: string,
		private model: string
	) {
		this.client = new OpenRouter({ apiKey });
	}

	async score(
		photo: PhotoBytes,
		dish: Pick<PictureSubject, 'title' | 'description'>
	): Promise<PhotoScore> {
		const dataUrl = `data:${photo.contentType};base64,${Buffer.from(photo.data).toString('base64')}`;
		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: photoJudgePrompt(dish) },
							{ type: 'image_url', imageUrl: { url: dataUrl } }
						]
					}
				],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});

		if (!completion || !('choices' in completion) || completion.choices.length === 0) {
			throw new Error('The photo judge gave no answer');
		}
		const content = completion.choices[0].message.content;
		const text =
			typeof content === 'string'
				? content
				: Array.isArray(content)
					? content
							.filter((part) => part.type === 'text')
							.map((part) => part.text)
							.join('')
					: '';
		if (!text) throw new Error('The photo judge gave an empty answer');
		return photoScoreSchema.parse(JSON.parse(text));
	}
}
