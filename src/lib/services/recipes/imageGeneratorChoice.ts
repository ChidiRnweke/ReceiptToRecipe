/**
 * Which image generator makes recipe pictures. Kept free of app imports, so the scripts can read
 * it with plain Node.
 */

/** FLUX 3 Image Klein, through OpenRouter's images endpoint. */
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-3-image-klein';

/** OpenRouter's OpenAI-compatible API, where the app's models run. */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type ImageGeneratorKind = 'seed' | 'openrouter';

/** `IMAGE_GENERATOR=seed` (or no OpenRouter key) uses the committed seed photos, else OpenRouter. */
export function chooseImageGenerator(settings: {
	setting: string | undefined;
	apiKey: string | undefined;
}): ImageGeneratorKind {
	const setting = settings.setting?.trim().toLowerCase() ?? '';
	if (setting === 'seed' || !settings.apiKey) return 'seed';
	return 'openrouter';
}
