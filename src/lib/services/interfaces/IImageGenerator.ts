export interface GeneratedImage {
	url: string;
	revisedPrompt?: string;
}

export interface IImageGenerator {
	/**
	 * Generate an image from a text prompt
	 * @param prompt - Text description of the image to generate
	 * @param size - Image size (default: 1024x1024)
	 * @returns Generated image URL
	 */
	generateImage(
		prompt: string,
		size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
	): Promise<GeneratedImage>;

	/**
	 * Generate a food/recipe image with optimized prompt
	 * @param recipeTitle - Title of the recipe
	 * @param description - Recipe description
	 * @param ingredients - List of main ingredients
	 * @returns Generated image URL
	 */
	generateRecipeImage(
		recipeTitle: string,
		description?: string,
		ingredients?: string[]
	): Promise<GeneratedImage>;
}
