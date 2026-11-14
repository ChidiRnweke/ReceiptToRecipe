import { MockCulinaryIntelligence } from '../mocks';
import {
	NoRecipeInImageError,
	type CravingContext,
	type ImageRecipe,
	type ImageRecipeContext,
	type RecipeImage
} from '../../src/lib/services/interfaces/ICulinaryIntelligence';

/**
 * The mock culinary intelligence, keeping every craving and photo it was asked about. A photo
 * reads as `snapKind`; `'none'` makes it find no recipe.
 */
export class RecordingCulinaryIntelligence extends MockCulinaryIntelligence {
	readonly cravings: CravingContext[] = [];
	readonly photos: RecipeImage[] = [];
	snapKind: ImageRecipe['kind'] | 'none' = 'page';

	override async generateFromCraving(context: CravingContext) {
		this.cravings.push(context);
		return super.generateFromCraving(context);
	}

	override async recipeFromImage(
		image: RecipeImage,
		context: ImageRecipeContext
	): Promise<ImageRecipe> {
		this.photos.push(image);
		if (this.snapKind === 'none') throw new NoRecipeInImageError();
		const read = await super.recipeFromImage(image, context);
		return { ...read, kind: this.snapKind };
	}
}
