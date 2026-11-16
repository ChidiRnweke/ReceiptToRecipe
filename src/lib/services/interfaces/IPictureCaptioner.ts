import type { PictureSubject } from '$lib/models/recipes';

/**
 * Writes the scene caption a recipe picture is generated from: what the camera sees of the
 * served dish, without a list of ingredients.
 */
export interface IPictureCaptioner {
	caption(
		dish: Pick<PictureSubject, 'title' | 'description' | 'ingredients' | 'lastSteps'>
	): Promise<string>;
}
