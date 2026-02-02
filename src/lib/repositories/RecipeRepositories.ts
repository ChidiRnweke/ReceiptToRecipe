import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { 
	IRecipeRepository, 
	IRecipeIngredientRepository, 
	ISavedRecipeRepository 
} from './interfaces';
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
} from './daos';

export class RecipeRepository implements IRecipeRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<RecipeDao | null> {
		const recipe = await this.db.query.recipes.findFirst({
			where: eq(schema.recipes.id, id)
		});
		return recipe ? this.toDao(recipe) : null;
	}

	async findByIdWithIngredients(id: string): Promise<RecipeWithIngredientsDao | null> {
		const recipe = await this.db.query.recipes.findFirst({
			where: eq(schema.recipes.id, id),
			with: { ingredients: { orderBy: [schema.recipeIngredients.orderIndex] } }
		});

		if (!recipe) return null;

		return {
			...this.toDao(recipe),
			ingredients: recipe.ingredients.map(ing => this.ingredientToDao(ing))
		};
	}

	async findByUserId(userId: string, limit = 20): Promise<RecipeDao[]> {
		const recipes = await this.db.query.recipes.findMany({
			where: eq(schema.recipes.userId, userId),
			orderBy: [desc(schema.recipes.createdAt)],
			limit
		});
		return recipes.map(r => this.toDao(r));
	}

	async findByUserIdWithIngredients(userId: string, limit = 20): Promise<RecipeWithIngredientsDao[]> {
		const recipes = await this.db.query.recipes.findMany({
			where: eq(schema.recipes.userId, userId),
			orderBy: [desc(schema.recipes.createdAt)],
			limit,
			with: { ingredients: true }
		});

		return recipes.map(r => ({
			...this.toDao(r),
			ingredients: r.ingredients.map(ing => this.ingredientToDao(ing))
		}));
	}

	async findByReceiptId(receiptId: string): Promise<RecipeDao[]> {
		const recipes = await this.db.query.recipes.findMany({
			where: eq(schema.recipes.sourceReceiptId, receiptId),
			orderBy: [desc(schema.recipes.createdAt)],
			limit: 10
		});
		return recipes.map(r => this.toDao(r));
	}

	async findByIds(ids: string[]): Promise<RecipeDao[]> {
		if (ids.length === 0) return [];
		const recipes = await this.db.query.recipes.findMany({
			where: inArray(schema.recipes.id, ids)
		});
		return recipes.map(r => this.toDao(r));
	}

	async create(recipe: NewRecipeDao): Promise<RecipeDao> {
		const [created] = await this.db.insert(schema.recipes).values({
			userId: recipe.userId,
			sourceReceiptId: recipe.sourceReceiptId || null,
			title: recipe.title,
			description: recipe.description || null,
			instructions: recipe.instructions,
			servings: recipe.servings ?? 2,
			prepTime: recipe.prepTime ?? null,
			cookTime: recipe.cookTime ?? null,
			cuisineType: recipe.cuisineType ?? null,
			estimatedCalories: recipe.estimatedCalories ?? null,
			source: recipe.source || 'GENERATED'
		}).returning();
		return this.toDao(created);
	}

	async update(id: string, recipe: UpdateRecipeDao): Promise<RecipeDao> {
		const [updated] = await this.db.update(schema.recipes)
			.set({
				...recipe,
				updatedAt: new Date()
			})
			.where(eq(schema.recipes.id, id))
			.returning();
		return this.toDao(updated);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(schema.recipes).where(eq(schema.recipes.id, id));
	}

	async togglePublic(id: string): Promise<boolean> {
		const recipe = await this.findById(id);
		if (!recipe) throw new Error('Recipe not found');

		const newValue = !recipe.isPublic;
		await this.db.update(schema.recipes)
			.set({ isPublic: newValue })
			.where(eq(schema.recipes.id, id));

		return newValue;
	}

	async getImageStatus(id: string): Promise<RecipeImageStatusDao | null> {
		const recipe = await this.db.query.recipes.findFirst({
			where: eq(schema.recipes.id, id),
			columns: { imageStatus: true, imageUrl: true }
		});

		return recipe ? {
			imageStatus: recipe.imageStatus,
			imageUrl: recipe.imageUrl
		} : null;
	}

	async countByReceiptIds(receiptIds: string[]): Promise<RecipeCountByReceiptDao[]> {
		if (receiptIds.length === 0) return [];

		const counts = await this.db
			.select({
				sourceReceiptId: schema.recipes.sourceReceiptId,
				count: sql<number>`count(*)`.as('count')
			})
			.from(schema.recipes)
			.where(inArray(schema.recipes.sourceReceiptId, receiptIds))
			.groupBy(schema.recipes.sourceReceiptId);

		return counts
			.filter(c => c.sourceReceiptId !== null)
			.map(c => ({ receiptId: c.sourceReceiptId!, count: c.count }));
	}

	async countByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(schema.recipes)
			.where(eq(schema.recipes.userId, userId));

		return result[0]?.count || 0;
	}

	private toDao(recipe: typeof schema.recipes.$inferSelect): RecipeDao {
		return {
			id: recipe.id,
			userId: recipe.userId,
			sourceReceiptId: recipe.sourceReceiptId,
			title: recipe.title,
			description: recipe.description,
			instructions: recipe.instructions,
			servings: recipe.servings,
			prepTime: recipe.prepTime,
			cookTime: recipe.cookTime,
			imageUrl: recipe.imageUrl,
			imageStatus: recipe.imageStatus as 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED',
			source: recipe.source as 'GENERATED' | 'RAG' | 'USER',
			cuisineType: recipe.cuisineType,
			estimatedCalories: recipe.estimatedCalories,
			isPublic: recipe.isPublic ?? false,
			createdAt: recipe.createdAt,
			updatedAt: recipe.updatedAt
		};
	}

	private ingredientToDao(ing: typeof schema.recipeIngredients.$inferSelect): RecipeIngredientDao {
		return {
			id: ing.id,
			recipeId: ing.recipeId,
			name: ing.name,
			quantity: ing.quantity,
			unit: ing.unit,
			unitType: ing.unitType as 'WEIGHT' | 'VOLUME' | 'COUNT',
			optional: ing.optional ?? false,
			notes: ing.notes,
			orderIndex: ing.orderIndex
		};
	}
}

export class RecipeIngredientRepository implements IRecipeIngredientRepository {
	constructor(private db: Database) {}

	async findByRecipeId(recipeId: string): Promise<RecipeIngredientDao[]> {
		const ingredients = await this.db.query.recipeIngredients.findMany({
			where: eq(schema.recipeIngredients.recipeId, recipeId),
			orderBy: [schema.recipeIngredients.orderIndex]
		});
		return ingredients.map(i => this.toDao(i));
	}

	async createMany(ingredients: NewRecipeIngredientDao[]): Promise<RecipeIngredientDao[]> {
		if (ingredients.length === 0) return [];
		const created = await this.db.insert(schema.recipeIngredients).values(ingredients).returning();
		return created.map(i => this.toDao(i));
	}

	async deleteByRecipeId(recipeId: string): Promise<void> {
		await this.db.delete(schema.recipeIngredients)
			.where(eq(schema.recipeIngredients.recipeId, recipeId));
	}

	private toDao(ing: typeof schema.recipeIngredients.$inferSelect): RecipeIngredientDao {
		return {
			id: ing.id,
			recipeId: ing.recipeId,
			name: ing.name,
			quantity: ing.quantity,
			unit: ing.unit,
			unitType: ing.unitType as 'WEIGHT' | 'VOLUME' | 'COUNT',
			optional: ing.optional ?? false,
			notes: ing.notes,
			orderIndex: ing.orderIndex
		};
	}
}

export class SavedRecipeRepository implements ISavedRecipeRepository {
	constructor(private db: Database) {}

	async findByUserId(userId: string): Promise<SavedRecipeDao[]> {
		const saved = await this.db.query.savedRecipes.findMany({
			where: eq(schema.savedRecipes.userId, userId),
			with: { recipe: true }
		});

		return saved.map(s => ({
			id: s.id,
			userId: s.userId,
			recipeId: s.recipeId,
			createdAt: s.createdAt,
			recipe: s.recipe ? {
				id: s.recipe.id,
				userId: s.recipe.userId,
				sourceReceiptId: s.recipe.sourceReceiptId,
				title: s.recipe.title,
				description: s.recipe.description,
				instructions: s.recipe.instructions,
				servings: s.recipe.servings,
				prepTime: s.recipe.prepTime,
				cookTime: s.recipe.cookTime,
				imageUrl: s.recipe.imageUrl,
				imageStatus: s.recipe.imageStatus as 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED',
				source: s.recipe.source as 'GENERATED' | 'RAG' | 'USER',
				cuisineType: s.recipe.cuisineType,
				estimatedCalories: s.recipe.estimatedCalories,
				isPublic: s.recipe.isPublic ?? false,
				createdAt: s.recipe.createdAt,
				updatedAt: s.recipe.updatedAt
			} : undefined
		}));
	}

	async findByUserAndRecipe(userId: string, recipeId: string): Promise<SavedRecipeDao | null> {
		const saved = await this.db.query.savedRecipes.findFirst({
			where: and(
				eq(schema.savedRecipes.userId, userId),
				eq(schema.savedRecipes.recipeId, recipeId)
			)
		});
		return saved ? this.toDao(saved) : null;
	}

	async exists(userId: string, recipeId: string): Promise<boolean> {
		const saved = await this.findByUserAndRecipe(userId, recipeId);
		return saved !== null;
	}

	async create(savedRecipe: NewSavedRecipeDao): Promise<SavedRecipeDao> {
		const [created] = await this.db.insert(schema.savedRecipes)
			.values({
				userId: savedRecipe.userId,
				recipeId: savedRecipe.recipeId
			})
			.onConflictDoNothing()
			.returning();
		
		if (!created) {
			// Already exists, find it
			const existing = await this.findByUserAndRecipe(savedRecipe.userId, savedRecipe.recipeId);
			if (!existing) throw new Error('Failed to create or find saved recipe');
			return existing;
		}
		
		return this.toDao(created);
	}

	async delete(userId: string, recipeId: string): Promise<void> {
		await this.db.delete(schema.savedRecipes)
			.where(and(
				eq(schema.savedRecipes.userId, userId),
				eq(schema.savedRecipes.recipeId, recipeId)
			));
	}

	async countByUserId(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(schema.savedRecipes)
			.where(eq(schema.savedRecipes.userId, userId));

		return result[0]?.count || 0;
	}

	private toDao(saved: typeof schema.savedRecipes.$inferSelect): SavedRecipeDao {
		return {
			id: saved.id,
			userId: saved.userId,
			recipeId: saved.recipeId,
			createdAt: saved.createdAt
		};
	}
}
