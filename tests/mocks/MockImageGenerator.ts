import type { IImageGenerator, GeneratedImage } from '../../src/lib/services/interfaces/IImageGenerator';

/**
 * Mock implementation of IImageGenerator for testing
 */
export class MockImageGenerator implements IImageGenerator {
	private mockImages = new Map<string, GeneratedImage>();
	private callCount = 0;

	async generateImage(
		prompt: string,
		size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
	): Promise<GeneratedImage> {
		this.callCount++;
		return this.mockImages.get(prompt) || {
			url: `mock://image-${this.callCount}.png`,
			revisedPrompt: prompt
		};
	}

	async generateRecipeImage(
		recipeTitle: string,
		description?: string,
		ingredients?: string[]
	): Promise<GeneratedImage> {
		this.callCount++;
		const key = `${recipeTitle}|${description || ''}|${ingredients?.join(',') || ''}`;
		return this.mockImages.get(key) || {
			url: `mock://recipe-image-${this.callCount}.png`,
			revisedPrompt: `Recipe: ${recipeTitle}`
		};
	}

	// Test helpers
	setMockImage(prompt: string, image: GeneratedImage): void {
		this.mockImages.set(prompt, image);
	}

	getCallCount(): number {
		return this.callCount;
	}

	clear(): void {
		this.mockImages.clear();
		this.callCount = 0;
	}
}
