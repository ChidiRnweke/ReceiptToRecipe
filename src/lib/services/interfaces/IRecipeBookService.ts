import type { RecipeSource, RecipeStep } from '$lib/models/recipes';
import type { RecipeDao } from '$repositories';
import type { GeneratedRecipe } from './ICulinaryIntelligence';
import type { KitchenAuthor } from './IKitchenService';

export interface NewRecipeContent {
	recipe: GeneratedRecipe;
	source: RecipeSource;
	sourceReceiptId?: string | null;
	/** A photo to show for the recipe. Without one, a picture is generated in the background. */
	photoUrl?: string | null;
}

/** Writes recipes with their ingredients and steps, and reads steps back. */
export interface IRecipeBookService {
	/**
	 * Saves a recipe for the author's household. Its steps come from `recipe.steps`, or from its
	 * instructions when it has none; `instructions` is stored as the same steps joined as text.
	 */
	create(author: KitchenAuthor, content: NewRecipeContent): Promise<RecipeDao>;
	/** Replaces a recipe's steps and rewrites its instructions to match. */
	replaceSteps(recipeId: string, steps: RecipeStep[]): Promise<RecipeStep[]>;
	/** The recipe's stored steps; a recipe without rows gets its instructions parsed. */
	stepsOf(recipe: Pick<RecipeDao, 'id' | 'instructions'>): Promise<RecipeStep[]>;
}
