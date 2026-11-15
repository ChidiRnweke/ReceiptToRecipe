import type {
	RecipeDao,
	NewRecipeDao,
	UpdateRecipeDao,
	RecipeWithIngredientsDao,
	RecipeIngredientDao,
	NewRecipeIngredientDao,
	SavedRecipeDao,
	NewSavedRecipeDao,
	RecipeImageStatusDao,
	RecipeCountByReceiptDao,
	RecipeStepDao,
	NewRecipeStepDao,
	RecipeWithoutPictureDao
} from '../daos';

export interface IRecipeRepository {
	findById(id: string): Promise<RecipeDao | null>;
	findByIdWithIngredients(id: string): Promise<RecipeWithIngredientsDao | null>;
	findByIds(ids: string[]): Promise<RecipeDao[]>;
	findByHouseholdId(householdId: string, limit?: number): Promise<RecipeDao[]>;
	findByHouseholdIdWithIngredients(
		householdId: string,
		limit?: number
	): Promise<RecipeWithIngredientsDao[]>;
	findByReceiptId(receiptId: string): Promise<RecipeDao[]>;
	create(recipe: NewRecipeDao): Promise<RecipeDao>;
	update(id: string, recipe: UpdateRecipeDao): Promise<RecipeDao>;
	delete(id: string): Promise<void>;
	togglePublic(id: string): Promise<boolean>;
	getImageStatus(id: string): Promise<RecipeImageStatusDao | null>;
	countByReceiptIds(receiptIds: string[]): Promise<RecipeCountByReceiptDao[]>;
	countByHouseholdId(householdId: string): Promise<number>;
	/**
	 * Recipes of every household that the model has not tagged yet, with their ingredients, in id
	 * order after `afterId`. Pass the last id of one batch to read the next.
	 */
	findNeedingTags(afterId: string | null, limit: number): Promise<RecipeWithIngredientsDao[]>;
	/** Recipes of every household that have no picture, oldest first. */
	findWithoutPicture(limit: number): Promise<RecipeWithoutPictureDao[]>;
}

export interface IRecipeIngredientRepository {
	findByRecipeId(recipeId: string): Promise<RecipeIngredientDao[]>;
	createMany(ingredients: NewRecipeIngredientDao[]): Promise<RecipeIngredientDao[]>;
	deleteByRecipeId(recipeId: string): Promise<void>;
}

export interface ISavedRecipeRepository {
	findByUserId(userId: string): Promise<SavedRecipeDao[]>;
	findByUserAndRecipe(userId: string, recipeId: string): Promise<SavedRecipeDao | null>;
	exists(userId: string, recipeId: string): Promise<boolean>;
	create(savedRecipe: NewSavedRecipeDao): Promise<SavedRecipeDao>;
	delete(userId: string, recipeId: string): Promise<void>;
	countByUserId(userId: string): Promise<number>;
}

/** The structured steps of recipes, in position order. */
export interface IRecipeStepRepository {
	findByRecipeId(recipeId: string): Promise<RecipeStepDao[]>;
	/** Replaces every step of the recipe with these, in one transaction. */
	replaceForRecipe(recipeId: string, steps: NewRecipeStepDao[]): Promise<RecipeStepDao[]>;
}
