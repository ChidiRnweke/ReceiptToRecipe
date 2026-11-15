import type { ImageCredit } from '$lib/models/recipes';

export interface GeneratedImage {
	/** A `data:` URL with the image, or the URL of an image that is already hosted. */
	url: string;
	revisedPrompt?: string;
	/** Set when the "generated" image is someone else's photo, as the seed pictures are. */
	credit?: ImageCredit;
}

export interface IImageGenerator {
	/**
	 * Generate an image from a text prompt
	 * @param prompt - Text description of the image to generate
	 * @returns The generated image
	 */
	generateImage(prompt: string): Promise<GeneratedImage>;
}
