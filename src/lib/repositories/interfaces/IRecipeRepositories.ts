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
} from "../daos";

export interface IRecipeRepository {
  findById(id: string): Promise<RecipeDao | null>;
  findByIdWithIngredients(id: string): Promise<RecipeWithIngredientsDao | null>;
  findByIds(ids: string[]): Promise<RecipeDao[]>;
  findByUserId(userId: string, limit?: number): Promise<RecipeDao[]>;
  findByUserIdWithIngredients(
    userId: string,
    limit?: number,
  ): Promise<RecipeWithIngredientsDao[]>;
  findByReceiptId(receiptId: string): Promise<RecipeDao[]>;
  create(recipe: NewRecipeDao): Promise<RecipeDao>;
  update(id: string, recipe: UpdateRecipeDao): Promise<RecipeDao>;
  delete(id: string): Promise<void>;
  togglePublic(id: string): Promise<boolean>;
  getImageStatus(id: string): Promise<RecipeImageStatusDao | null>;
  countByReceiptIds(receiptIds: string[]): Promise<RecipeCountByReceiptDao[]>;
  countByUserId(userId: string): Promise<number>;
}

export interface IRecipeIngredientRepository {
  findByRecipeId(recipeId: string): Promise<RecipeIngredientDao[]>;
  createMany(
    ingredients: NewRecipeIngredientDao[],
  ): Promise<RecipeIngredientDao[]>;
  deleteByRecipeId(recipeId: string): Promise<void>;
}

export interface ISavedRecipeRepository {
  findByUserId(userId: string): Promise<SavedRecipeDao[]>;
  findByUserAndRecipe(
    userId: string,
    recipeId: string,
  ): Promise<SavedRecipeDao | null>;
  exists(userId: string, recipeId: string): Promise<boolean>;
  create(savedRecipe: NewSavedRecipeDao): Promise<SavedRecipeDao>;
  delete(userId: string, recipeId: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}
