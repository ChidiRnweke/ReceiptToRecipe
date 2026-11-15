import type { GeneratedImage, IImageGenerator } from './interfaces/IImageGenerator';
import {
	pickSeedPicture,
	SEED_PICTURE_PATH,
	seedPictureCredit,
	type SeedPictureCatalog
} from './recipes/seedPictures';

/**
 * Stands in for image generation where no image model is available, e.g. local runs without
 * an OpenRouter key. It answers with the committed seed photo that best fits the prompt, and
 * with that photo's credit.
 */
export class SeedPictureGenerator implements IImageGenerator {
	constructor(private catalog: SeedPictureCatalog) {}

	async generateImage(prompt: string): Promise<GeneratedImage> {
		const picture = pickSeedPicture(this.catalog, prompt);
		return { url: `${SEED_PICTURE_PATH}/${picture.file}`, credit: seedPictureCredit(picture) };
	}
}
