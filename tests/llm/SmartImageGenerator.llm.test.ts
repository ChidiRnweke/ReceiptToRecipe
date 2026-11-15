/// <reference types="vitest/globals" />
import { describeLLM, OPENROUTER_API_KEY, withRetry } from './setup';
import { SmartImageGenerator } from '../../src/lib/services/SmartImageGenerator';
import { recipePicturePrompt } from '../../src/lib/services/recipes/pictureStyle';
import { DEFAULT_IMAGE_MODEL } from '../../src/lib/services/recipes/imageGeneratorChoice';

/**
 * Image generation tests use the app's image model (OPENROUTER_IMAGE_MODEL, else FLUX 3 Image
 * Klein) through OpenRouter's images endpoint. These tests are more expensive and slower.
 *
 * NOTE: Image generation is inherently non-deterministic and can fail
 * due to content policy filters, so tests are lenient.
 */
describeLLM('SmartImageGenerator (LLM Integration)', () => {
	let service: SmartImageGenerator;

	beforeAll(() => {
		service = new SmartImageGenerator(
			OPENROUTER_API_KEY,
			process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
		);
	});

	describe('generateImage', () => {
		it('should return a GeneratedImage with a URL', async () => {
			const result = await withRetry(
				() => service.generateImage('A simple red apple on a white background, minimal style'),
				2,
				2000
			);

			expect(result).toHaveProperty('url');
			expect(typeof result.url).toBe('string');
			expect(result.url.length).toBeGreaterThan(0);
		}, 60000);
	});

	describe('house style', () => {
		it('generates a recipe picture from the house style prompt', async () => {
			const result = await withRetry(
				() =>
					service.generateImage(
						recipePicturePrompt({
							title: 'Spinach & feta frittata',
							description: 'Eggs, potato and spinach, finished under the grill',
							ingredients: ['eggs', 'potato', 'spinach', 'feta']
						})
					),
				2,
				2000
			);

			expect(result.url).toMatch(/^data:image\/[a-z]+;base64,/);
		}, 60000);
	});
});
