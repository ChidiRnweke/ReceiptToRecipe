import { db } from '$db/client';
import { recipes, recipeIngredients, receiptItems, userPreferences, savedRecipes } from '$db/schema';
import type { Recipe, RecipeIngredient, NewRecipe, NewRecipeIngredient, UserPreferences } from '$db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import type { ILlmService, IImageGenService, IVectorService, GeneratedRecipe, TasteProfileService } from '$services';

export interface GenerateRecipeInput {
	userId: string;
	ingredientIds?: string[]; // Receipt item IDs to use
	customIngredients?: string[]; // Additional ingredients to include
	servings?: number;
	cuisineHint?: string;
	useRag?: boolean; // Whether to use cookbook RAG
	sourceReceiptId?: string; // The primary receipt this recipe was generated from
}

export interface RecipeWithIngredients extends Recipe {
	ingredients: RecipeIngredient[];
}

export class RecipeController {
	constructor(
		private llmService: ILlmService,
		private imageGenService: IImageGenService,
		private vectorService: IVectorService,
		private tasteProfileService: TasteProfileService,
		private jobQueue?: { add: (job: { name?: string; run: () => Promise<void> }) => Promise<void> }
	) {}

	/**
	 * Generate a recipe from available ingredients
	 */
	async generateRecipe(input: GenerateRecipeInput): Promise<Recipe> {
		const { userId, ingredientIds, customIngredients, servings, cuisineHint, useRag, sourceReceiptId } = input;

		// Get user preferences
		const preferences = await db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, userId)
		});

        // Get taste profile
        const tasteProfile = await this.tasteProfileService.getUserTasteProfile(userId);

		// Gather ingredients
		const ingredients: string[] = [...(customIngredients || [])];

		if (ingredientIds?.length) {
			const items = await db.query.receiptItems.findMany({
				where: inArray(receiptItems.id, ingredientIds)
			});
			ingredients.push(...items.map((item) => item.normalizedName));
		}

		if (ingredients.length === 0) {
			throw new Error('No ingredients provided');
		}

		// Get RAG context if enabled
		let cookbookContext: string | undefined;
		if (useRag) {
			const query = ingredients.slice(0, 5).join(', ');
			const results = await this.vectorService.searchByText(query, 3);
			if (results.length > 0) {
				cookbookContext = results.map((r) => r.contentChunk).join('\n\n');
			}
		}

		// Generate recipe via LLM
		const generatedRecipe = await this.llmService.generateRecipe({
			availableIngredients: ingredients,
			preferences: preferences || {},
            tasteProfile,
			servings: servings || preferences?.defaultServings || 2,
			cuisineHint,
			cookbookContext
		});

		// Save recipe to database
		const recipe = await this.persistRecipe(userId, generatedRecipe, useRag ? 'RAG' : 'GENERATED', sourceReceiptId);


		const task = () =>
			this.generateRecipeImage(recipe.id, generatedRecipe).catch((error) => {
				console.error(`Image generation failed for recipe ${recipe.id}:`, error);
			});

		if (this.jobQueue) {
			this.jobQueue.add({ name: `recipe-image:${recipe.id}`, run: task }).catch((error) => {
				console.error('Failed to enqueue image job', error);
				task();
			});
		} else {
			task();
		}

		return recipe;
	}

	/**
	 * Save a generated recipe to the database
	 */
	private async persistRecipe(
		userId: string,
		generated: GeneratedRecipe,
		source: 'GENERATED' | 'RAG' | 'USER',
		sourceReceiptId?: string
	): Promise<Recipe> {
		const [recipe] = await db
			.insert(recipes)
			.values({
				userId,
				sourceReceiptId: sourceReceiptId || null,
				title: generated.title,
				description: generated.description,
				instructions: generated.instructions,
				servings: generated.servings,
				prepTime: generated.prepTime,
				cookTime: generated.cookTime,
				cuisineType: generated.cuisineType,
				estimatedCalories: generated.estimatedCalories,
				source,
				imageStatus: 'QUEUED'
			})
			.returning();

		// Save ingredients
		if (generated.ingredients.length > 0) {
			const ingredientValues: NewRecipeIngredient[] = generated.ingredients.map((ing, index) => ({
				recipeId: recipe.id,
				name: ing.name,
				quantity: ing.quantity.toString(),
				unit: ing.unit,
				unitType: this.inferUnitType(ing.unit),
				optional: ing.optional || false,
				notes: ing.notes,
				orderIndex: index
			}));

			await db.insert(recipeIngredients).values(ingredientValues);
		}

		return recipe;
	}

	/**
	 * Background image generation
	 */
	private async generateRecipeImage(recipeId: string, generated: GeneratedRecipe): Promise<void> {
		try {
			await db.update(recipes).set({ imageStatus: 'PROCESSING' }).where(eq(recipes.id, recipeId));

			const ingredientNames = generated.ingredients.slice(0, 5).map((i) => i.name);
			const result = await this.imageGenService.generateRecipeImage(
				generated.title,
				generated.description,
				ingredientNames
			);

			await db
				.update(recipes)
				.set({
					imageUrl: result.url,
					imageStatus: 'DONE',
					updatedAt: new Date()
				})
				.where(eq(recipes.id, recipeId));
		} catch (error) {
			console.error('Image generation error:', error);
			await db
				.update(recipes)
				.set({
					imageStatus: 'FAILED',
					updatedAt: new Date()
				})
				.where(eq(recipes.id, recipeId));
		}
	}

	/**
	 * Infer unit type from unit string
	 */
	private inferUnitType(unit: string): 'WEIGHT' | 'VOLUME' | 'COUNT' {
		const weightUnits = ['g', 'kg', 'oz', 'lb', 'lbs', 'mg'];
		const volumeUnits = ['ml', 'l', 'cup', 'cups', 'tbsp', 'tsp', 'fl oz', 'pint', 'quart', 'gallon'];

		const lower = unit.toLowerCase();
		if (weightUnits.includes(lower)) return 'WEIGHT';
		if (volumeUnits.includes(lower)) return 'VOLUME';
		return 'COUNT';
	}

	/**
	 * Get recipe by ID with ingredients
	 */
	async getRecipe(recipeId: string, userId?: string): Promise<RecipeWithIngredients | null> {
		const recipe = await db.query.recipes.findFirst({
			where: userId
				? and(eq(recipes.id, recipeId), eq(recipes.userId, userId))
				: eq(recipes.id, recipeId),
			with: {
				ingredients: {
					orderBy: [recipeIngredients.orderIndex]
				}
			}
		});

		// Check if recipe is public or belongs to user
		if (recipe && !recipe.isPublic && recipe.userId !== userId) {
			return null;
		}

		return recipe || null;
	}

	/**
	 * Get recipe with adjusted servings
	 */
	async getRecipeWithServings(
		recipeId: string,
		targetServings: number,
		userId?: string
	): Promise<RecipeWithIngredients | null> {
		const recipe = await this.getRecipe(recipeId, userId);
		if (!recipe) return null;

		const scaleFactor = targetServings / recipe.servings;

		return {
			...recipe,
			servings: targetServings,
			ingredients: recipe.ingredients.map((ing) => ({
				...ing,
				quantity: (parseFloat(ing.quantity) * scaleFactor).toFixed(2)
			}))
		};
	}

	/**
	 * Get all recipes for a user
	 */
	async getUserRecipes(userId: string, limit: number = 20): Promise<Recipe[]> {
		return db.query.recipes.findMany({
			where: eq(recipes.userId, userId),
			orderBy: [desc(recipes.createdAt)],
			limit
		});
	}

	/**
	 * Get all recipes for a user with ingredients
	 */
	async getUserRecipesWithIngredients(userId: string, limit: number = 20): Promise<RecipeWithIngredients[]> {
		return db.query.recipes.findMany({
			where: eq(recipes.userId, userId),
			orderBy: [desc(recipes.createdAt)],
			limit,
			with: {
				ingredients: true
			}
		});
	}

	/**
	 * Save/favorite a recipe
	 */
	async saveRecipe(userId: string, recipeId: string): Promise<void> {
		await db
			.insert(savedRecipes)
			.values({ userId, recipeId })
			.onConflictDoNothing();
	}

	/**
	 * Unsave/unfavorite a recipe
	 */
	async unsaveRecipe(userId: string, recipeId: string): Promise<void> {
		await db
			.delete(savedRecipes)
			.where(and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId)));
	}

	/**
	 * Get saved recipes for a user
	 */
	async getSavedRecipes(userId: string): Promise<Recipe[]> {
		const saved = await db.query.savedRecipes.findMany({
			where: eq(savedRecipes.userId, userId),
			with: {
				recipe: true
			}
		});

		return saved.map((s) => s.recipe);
	}

	/**
	 * Check if a recipe is saved by a user
	 */
	async isSaved(userId: string, recipeId: string): Promise<boolean> {
		const saved = await db.query.savedRecipes.findFirst({
			where: and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId))
		});
		return Boolean(saved);
	}

	/**
	 * Toggle recipe public/private
	 */
	async togglePublic(recipeId: string, userId: string): Promise<boolean> {
		const recipe = await db.query.recipes.findFirst({
			where: and(eq(recipes.id, recipeId), eq(recipes.userId, userId))
		});

		if (!recipe) {
			throw new Error('Recipe not found');
		}

		const newValue = !recipe.isPublic;
		await db.update(recipes).set({ isPublic: newValue }).where(eq(recipes.id, recipeId));

		return newValue;
	}

	/**
	 * Delete a recipe
	 */
	async deleteRecipe(recipeId: string, userId: string): Promise<void> {
		const recipe = await db.query.recipes.findFirst({
			where: and(eq(recipes.id, recipeId), eq(recipes.userId, userId))
		});

		if (!recipe) {
			throw new Error('Recipe not found');
		}

		await db.delete(recipes).where(eq(recipes.id, recipeId));
	}

	/**
	 * Get recipe image status (for polling)
	 */
	async getImageStatus(
		recipeId: string
	): Promise<{ imageStatus: string | null; imageUrl: string | null } | null> {
		const recipe = await db.query.recipes.findFirst({
			where: eq(recipes.id, recipeId),
			columns: {
				imageStatus: true,
				imageUrl: true
			}
		});

		return recipe || null;
	}
}
