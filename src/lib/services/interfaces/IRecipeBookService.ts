import type { RecipeSource, RecipeStep } from '$lib/models/recipes';
import type { RecipeDao } from '$repositories';
import type { GeneratedRecipe, ICulinaryIntelligence } from './ICulinaryIntelligence';
import type { KitchenAuthor } from './IKitchenService';

export interface NewRecipeContent {
	recipe: GeneratedRecipe;
	source: RecipeSource;
	sourceReceiptId?: string | null;
}

/** Judges recipes' planning and course tags; the culinary intelligence does. */
export type RecipeTagger = Pick<ICulinaryIntelligence, 'tagRecipes'>;

/** What one tagging run did. */
export interface TaggingSummary {
	/** Recipes tagged in this run. */
	tagged: number;
	/** Of those, recipes the model judged too. The rest got the rule tags only. */
	judged: number;
}

/** Writes recipes with their ingredients, steps and tags, and reads steps back. */
export interface IRecipeBookService {
	/**
	 * Saves a recipe for the author's household, without a picture: the caller asks the picture
	 * service for one. Its steps come from `recipe.steps`, or from its
	 * instructions when it has none; `instructions` is stored as the same steps joined as text.
	 * Its tags are the rule tags plus the tags the model gave with the recipe.
	 */
	create(author: KitchenAuthor, content: NewRecipeContent): Promise<RecipeDao>;
	/** Replaces a recipe's steps and rewrites its instructions to match. */
	replaceSteps(recipeId: string, steps: RecipeStep[]): Promise<RecipeStep[]>;
	/** The recipe's stored steps; a recipe without rows gets its instructions parsed. */
	stepsOf(recipe: Pick<RecipeDao, 'id' | 'instructions'>): Promise<RecipeStep[]>;
	/** Sets a changed recipe's rule tags again from its ingredients and steps; judged tags stay. */
	retag(recipeId: string): Promise<void>;
	/**
	 * Tags every recipe the model has not judged yet, 20 per model call. When the model fails,
	 * the recipe gets its rule tags only and the model is not asked again in this run.
	 */
	tagUntagged(): Promise<TaggingSummary>;
	/** Runs `tagUntagged` on the job queue; resolves with its summary when it is done. */
	queueTagging(): Promise<TaggingSummary>;
}
