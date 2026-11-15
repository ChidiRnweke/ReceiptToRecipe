/**
 * Which image generator makes recipe pictures. Kept free of app imports, so the scripts can read
 * it with plain Node.
 */

/** FLUX 3 Image Klein through OpenRouter; the same model runs on a Mac with `IMAGE_GENERATOR=local`. */
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-3-image-klein';

/** The model the local worker runs when FLUX_LOCAL_MODEL is not set (8-bit, about 10 GB). */
export const DEFAULT_LOCAL_FLUX_MODEL = 'mflux-community/flux-3-image-klein-mflux-q8';

export type ImageGeneratorKind = 'seed' | 'local' | 'openrouter';

/**
 * `IMAGE_GENERATOR=seed` (or no OpenRouter key) uses the committed seed photos, `local` runs FLUX
 * on this machine, anything else uses OpenRouter. The local worker is for development and batch
 * runs on a Mac; a production server refuses it rather than start a 10 GB model download.
 */
export function chooseImageGenerator(settings: {
	setting: string | undefined;
	apiKey: string | undefined;
	production: boolean;
}): ImageGeneratorKind {
	const setting = settings.setting?.trim().toLowerCase() ?? '';
	if (setting === 'local') {
		if (settings.production) {
			throw new Error(
				'IMAGE_GENERATOR=local runs FLUX on a developer machine and is not available in production. ' +
					'Unset IMAGE_GENERATOR to use OpenRouter.'
			);
		}
		return 'local';
	}
	if (setting === 'seed' || !settings.apiKey) return 'seed';
	return 'openrouter';
}
