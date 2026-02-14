import type {
	IRecipeRepository,
	IRecipeIngredientRepository,
	ISavedRecipeRepository
} from '../../src/lib/repositories/interfaces/IRecipeRepositories';
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
	RecipeCountByReceiptDao
} from '../../src/lib/repositories/daos';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of IRecipeRepository for testing
 */
export class MockRecipeRepository implements IRecipeRepository {
	private recipes = new Map<string, RecipeDao>();
	private ingredientRepo?: IRecipeIngredientRepository;

	setIngredientRepository(repo: IRecipeIngredientRepository): void {
		this.ingredientRepo = repo;
	}

	async findById(id: string): Promise<RecipeDao | null> {
		return this.recipes.get(id) || null;
	}

	async findByIdWithIngredients(id: string): Promise<RecipeWithIngredientsDao | null> {
		const recipe = this.recipes.get(id);
		if (!recipe) return null;
		let ingredients: RecipeIngredientDao[] = [];
		if (this.ingredientRepo) {
			ingredients = await this.ingredientRepo.findByRecipeId(id);
		}
		return { ...recipe, ingredients };
	}

	async findByIds(ids: string[]): Promise<RecipeDao[]> {
		return ids.map((id) => this.recipes.get(id)).filter((r): r is RecipeDao => !!r);
	}

	async findByUserId(userId: string, limit?: number): Promise<RecipeDao[]> {
		const results = Array.from(this.recipes.values())
			.filter((r) => r.userId === userId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return limit ? results.slice(0, limit) : results;
	}

	async findByUserIdWithIngredients(
		userId: string,
		limit?: number
	): Promise<RecipeWithIngredientsDao[]> {
		const recipes = await this.findByUserId(userId, limit);
		const results: RecipeWithIngredientsDao[] = [];
		for (const r of recipes) {
			let ingredients: RecipeIngredientDao[] = [];
			if (this.ingredientRepo) {
				ingredients = await this.ingredientRepo.findByRecipeId(r.id);
			}
			results.push({ ...r, ingredients });
		}
		return results;
	}

	async findByReceiptId(receiptId: string): Promise<RecipeDao[]> {
		return Array.from(this.recipes.values()).filter((r) => r.sourceReceiptId === receiptId);
	}

	async create(recipe: NewRecipeDao): Promise<RecipeDao> {
		const now = new Date();
		const created: RecipeDao = {
			id: uuidv4(),
			userId: recipe.userId,
			sourceReceiptId: recipe.sourceReceiptId || null,
			title: recipe.title,
			description: recipe.description || null,
			instructions: recipe.instructions,
			servings: recipe.servings || 2,
			prepTime: recipe.prepTime || null,
			cookTime: recipe.cookTime || null,
			imageUrl: null,
			imageStatus: 'QUEUED',
			source: recipe.source || 'GENERATED',
			cuisineType: recipe.cuisineType || null,
			estimatedCalories: recipe.estimatedCalories || null,
			isPublic: false,
			createdAt: now,
			updatedAt: now
		};
		this.recipes.set(created.id, created);
		return created;
	}

	async update(id: string, recipe: UpdateRecipeDao): Promise<RecipeDao> {
		const existing = this.recipes.get(id);
		if (!existing) throw new Error(`Recipe ${id} not found`);

		const updated: RecipeDao = {
			...existing,
			...recipe,
			id: existing.id,
			userId: existing.userId,
			sourceReceiptId: existing.sourceReceiptId,
			createdAt: existing.createdAt,
			updatedAt: new Date()
		};
		this.recipes.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<void> {
		this.recipes.delete(id);
	}

	async togglePublic(id: string): Promise<boolean> {
		const recipe = this.recipes.get(id);
		if (!recipe) throw new Error(`Recipe ${id} not found`);
		recipe.isPublic = !recipe.isPublic;
		recipe.updatedAt = new Date();
		return recipe.isPublic;
	}

	async getImageStatus(id: string): Promise<RecipeImageStatusDao | null> {
		const recipe = this.recipes.get(id);
		if (!recipe) return null;
		return {
			imageStatus: recipe.imageStatus,
			imageUrl: recipe.imageUrl
		};
	}

	async countByReceiptIds(receiptIds: string[]): Promise<RecipeCountByReceiptDao[]> {
		return receiptIds.map((receiptId) => ({
			receiptId,
			count: Array.from(this.recipes.values()).filter((r) => r.sourceReceiptId === receiptId).length
		}));
	}

	async countByUserId(userId: string): Promise<number> {
		return Array.from(this.recipes.values()).filter((r) => r.userId === userId).length;
	}

	// Test helpers
	getStored(id: string): RecipeDao | undefined {
		return this.recipes.get(id);
	}

	getAllStored(): RecipeDao[] {
		return Array.from(this.recipes.values());
	}

	clear(): void {
		this.recipes.clear();
	}
}

/**
 * Mock implementation of IRecipeIngredientRepository for testing
 */
export class MockRecipeIngredientRepository implements IRecipeIngredientRepository {
	private ingredients = new Map<string, RecipeIngredientDao>();

	async findByRecipeId(recipeId: string): Promise<RecipeIngredientDao[]> {
		return Array.from(this.ingredients.values())
			.filter((i) => i.recipeId === recipeId)
			.sort((a, b) => a.orderIndex - b.orderIndex);
	}

	async createMany(ingredients: NewRecipeIngredientDao[]): Promise<RecipeIngredientDao[]> {
		const created: RecipeIngredientDao[] = [];
		for (const ing of ingredients) {
			const newIng: RecipeIngredientDao = {
				id: uuidv4(),
				recipeId: ing.recipeId,
				name: ing.name,
				quantity: ing.quantity,
				unit: ing.unit,
				unitType: ing.unitType,
				optional: ing.optional || false,
				notes: ing.notes || null,
				orderIndex: ing.orderIndex
			};
			this.ingredients.set(newIng.id, newIng);
			created.push(newIng);
		}
		return created;
	}

	async deleteByRecipeId(recipeId: string): Promise<void> {
		for (const [id, ing] of this.ingredients) {
			if (ing.recipeId === recipeId) {
				this.ingredients.delete(id);
			}
		}
	}

	// Test helpers
	getStored(id: string): RecipeIngredientDao | undefined {
		return this.ingredients.get(id);
	}

	clear(): void {
		this.ingredients.clear();
	}
}

/**
 * Mock implementation of ISavedRecipeRepository for testing
 */
export class MockSavedRecipeRepository implements ISavedRecipeRepository {
	private savedRecipes = new Map<string, SavedRecipeDao>();

	private getKey(userId: string, recipeId: string): string {
		return `${userId}:${recipeId}`;
	}

	async findByUserId(userId: string): Promise<SavedRecipeDao[]> {
		return Array.from(this.savedRecipes.values())
			.filter((sr) => sr.userId === userId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async findByUserAndRecipe(userId: string, recipeId: string): Promise<SavedRecipeDao | null> {
		return this.savedRecipes.get(this.getKey(userId, recipeId)) || null;
	}

	async exists(userId: string, recipeId: string): Promise<boolean> {
		return this.savedRecipes.has(this.getKey(userId, recipeId));
	}

	async create(savedRecipe: NewSavedRecipeDao): Promise<SavedRecipeDao> {
		const created: SavedRecipeDao = {
			id: uuidv4(),
			userId: savedRecipe.userId,
			recipeId: savedRecipe.recipeId,
			createdAt: new Date()
		};
		this.savedRecipes.set(this.getKey(savedRecipe.userId, savedRecipe.recipeId), created);
		return created;
	}

	async delete(userId: string, recipeId: string): Promise<void> {
		this.savedRecipes.delete(this.getKey(userId, recipeId));
	}

	async countByUserId(userId: string): Promise<number> {
		return Array.from(this.savedRecipes.values()).filter((sr) => sr.userId === userId).length;
	}

	// Test helpers
	clear(): void {
		this.savedRecipes.clear();
	}
}
