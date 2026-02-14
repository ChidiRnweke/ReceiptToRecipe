import type {
	IRecipeRepository,
	IRecipeIngredientRepository,
	ISavedRecipeRepository,
	IUserPreferencesRepository,
	IReceiptItemRepository
} from '$repositories';
import type {
	RecipeDao,
	NewRecipeDao,
	RecipeWithIngredientsDao,
	RecipeIngredientDao,
	NewRecipeIngredientDao
} from '$repositories';
import type {
	ICulinaryIntelligence,
	IImageGenerator,
	IVectorService,
	LlmGeneratedRecipe,
	ITasteProfileService
} from '$services';

export interface GenerateRecipeInput {
	userId: string;
	ingredientIds?: string[]; // Receipt item IDs to use
	customIngredients?: string[]; // Additional ingredients to include
	servings?: number;
	cuisineHint?: string;
	useRag?: boolean; // Whether to use cookbook RAG
	sourceReceiptId?: string; // The primary receipt this recipe was generated from
}

export interface RecipeWithIngredients extends RecipeDao {
	ingredients: RecipeIngredientDao[];
}

export class RecipeController {
	constructor(
		private culinaryIntelligence: ICulinaryIntelligence,
		private imageGenerator: IImageGenerator,
		private vectorService: IVectorService,
		private tasteProfileService: ITasteProfileService,
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private savedRecipeRepository: ISavedRecipeRepository,
		private userPreferencesRepository: IUserPreferencesRepository,
		private receiptItemRepository: IReceiptItemRepository,
		private jobQueue?: {
			add: (job: { name?: string; run: () => Promise<void> }) => Promise<void>;
		}
	) {}

	/**
	 * Generate a recipe from available ingredients
	 */
	async generateRecipe(input: GenerateRecipeInput): Promise<RecipeDao> {
		const {
			userId,
			ingredientIds,
			customIngredients,
			servings,
			cuisineHint,
			useRag,
			sourceReceiptId
		} = input;

		// Get user preferences
		const preferences = await this.userPreferencesRepository.findByUserId(userId);

		// Get taste profile
		const tasteProfile = await this.tasteProfileService.getUserTasteProfile(userId);

		// Gather ingredients
		const ingredients: string[] = [...(customIngredients || [])];

		if (ingredientIds?.length) {
			const items = await Promise.all(
				ingredientIds.map((id) => this.receiptItemRepository.findById(id))
			);
			ingredients.push(
				...items
					.filter((item): item is NonNullable<typeof item> => item !== null)
					.map((item) => item.normalizedName)
			);
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

		// Generate recipe via AI
		const generatedRecipe = await this.culinaryIntelligence.generateRecipe({
			availableIngredients: ingredients,
			preferences: preferences || {},
			tasteProfile,
			servings: servings || preferences?.defaultServings || 2,
			cuisineHint,
			cookbookContext
		});

		// Save recipe to database
		const recipe = await this.persistRecipe(
			userId,
			generatedRecipe,
			useRag ? 'RAG' : 'GENERATED',
			sourceReceiptId
		);

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
		generated: LlmGeneratedRecipe,
		source: 'GENERATED' | 'RAG' | 'USER',
		sourceReceiptId?: string
	): Promise<RecipeDao> {
		const recipe = await this.recipeRepository.create({
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
			source
		});

		// Save ingredients
		if (generated.ingredients.length > 0) {
			const ingredientValues: NewRecipeIngredientDao[] = generated.ingredients.map(
				(
					ing: {
						name: string;
						quantity: number | string;
						unit: string;
						optional?: boolean;
						notes?: string;
					},
					index: number
				) => ({
					recipeId: recipe.id,
					name: ing.name,
					quantity: ing.quantity.toString(),
					unit: ing.unit,
					unitType: this.inferUnitType(ing.unit),
					optional: ing.optional || false,
					notes: ing.notes,
					orderIndex: index
				})
			);

			await this.recipeIngredientRepository.createMany(ingredientValues);
		}

		return recipe;
	}

	/**
	 * Background image generation
	 */
	private async generateRecipeImage(
		recipeId: string,
		generated: LlmGeneratedRecipe
	): Promise<void> {
		try {
			await this.recipeRepository.update(recipeId, {
				imageStatus: 'PROCESSING'
			});

			const ingredientNames = generated.ingredients
				.slice(0, 5)
				.map((i: { name: string }) => i.name);
			const result = await this.imageGenerator.generateRecipeImage(
				generated.title,
				generated.description,
				ingredientNames
			);

			await this.recipeRepository.update(recipeId, {
				imageUrl: result.url,
				imageStatus: 'DONE'
			});
		} catch (error) {
			console.error('Image generation error:', error);
			await this.recipeRepository.update(recipeId, {
				imageStatus: 'FAILED'
			});
		}
	}

	/**
	 * Infer unit type from unit string
	 */
	private inferUnitType(unit: string): 'WEIGHT' | 'VOLUME' | 'COUNT' {
		const weightUnits = ['g', 'kg', 'oz', 'lb', 'lbs', 'mg'];
		const volumeUnits = [
			'ml',
			'l',
			'cup',
			'cups',
			'tbsp',
			'tsp',
			'fl oz',
			'pint',
			'quart',
			'gallon'
		];

		const lower = unit.toLowerCase();
		if (weightUnits.includes(lower)) return 'WEIGHT';
		if (volumeUnits.includes(lower)) return 'VOLUME';
		return 'COUNT';
	}

	/**
	 * Get recipe by ID with ingredients
	 */
	async getRecipe(recipeId: string, userId?: string): Promise<RecipeWithIngredients | null> {
		const recipe = await this.recipeRepository.findByIdWithIngredients(recipeId);

		if (!recipe) return null;

		// If userId is provided, check ownership or public access
		if (userId && recipe.userId !== userId && !recipe.isPublic) {
			return null;
		}

		// If no userId provided, only return public recipes
		if (!userId && !recipe.isPublic) {
			return null;
		}

		return recipe;
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
	async getUserRecipes(userId: string, limit: number = 20): Promise<RecipeDao[]> {
		return this.recipeRepository.findByUserId(userId, limit);
	}

	/**
	 * Get all recipes for a user with ingredients
	 */
	async getUserRecipesWithIngredients(
		userId: string,
		limit: number = 20
	): Promise<RecipeWithIngredientsDao[]> {
		return this.recipeRepository.findByUserIdWithIngredients(userId, limit);
	}

	/**
	 * Save/favorite a recipe
	 */
	async saveRecipe(userId: string, recipeId: string): Promise<void> {
		const existing = await this.savedRecipeRepository.findByUserAndRecipe(userId, recipeId);
		if (!existing) {
			await this.savedRecipeRepository.create({ userId, recipeId });
		}
	}

	/**
	 * Unsave/unfavorite a recipe
	 */
	async unsaveRecipe(userId: string, recipeId: string): Promise<void> {
		await this.savedRecipeRepository.delete(userId, recipeId);
	}

	/**
	 * Get saved recipes for a user
	 */
	async getSavedRecipes(userId: string): Promise<RecipeDao[]> {
		const saved = await this.savedRecipeRepository.findByUserId(userId);
		if (saved.length === 0) return [];

		const recipeIds = saved.map((s) => s.recipeId);
		return this.recipeRepository.findByIds(recipeIds);
	}

	/**
	 * Check if a recipe is saved by a user
	 */
	async isSaved(userId: string, recipeId: string): Promise<boolean> {
		return this.savedRecipeRepository.exists(userId, recipeId);
	}

	/**
	 * Toggle recipe public/private
	 */
	async togglePublic(recipeId: string, userId: string): Promise<boolean> {
		const recipe = await this.recipeRepository.findById(recipeId);

		if (!recipe || recipe.userId !== userId) {
			throw new Error('Recipe not found');
		}

		return this.recipeRepository.togglePublic(recipeId);
	}

	/**
	 * Delete a recipe
	 */
	async deleteRecipe(recipeId: string, userId: string): Promise<void> {
		const recipe = await this.recipeRepository.findById(recipeId);

		if (!recipe || recipe.userId !== userId) {
			throw new Error('Recipe not found');
		}

		await this.recipeRepository.delete(recipeId);
	}

	/**
	 * Get recipe image status (for polling)
	 */
	async getImageStatus(
		recipeId: string
	): Promise<{ imageStatus: string | null; imageUrl: string | null } | null> {
		return this.recipeRepository.getImageStatus(recipeId);
	}

	/**
	 * Update a recipe with adjusted ingredients and instructions
	 */
	async updateRecipe(
		recipeId: string,
		userId: string,
		updates: {
			title?: string;
			description?: string;
			instructions?: string;
			ingredients?: Array<{
				name: string;
				quantity: string;
				unit: string;
				optional?: boolean;
				notes?: string;
			}>;
		}
	): Promise<RecipeWithIngredients> {
		// Verify ownership
		const recipe = await this.recipeRepository.findById(recipeId);

		if (!recipe || recipe.userId !== userId) {
			throw new Error('Recipe not found or not authorized');
		}

		// Update recipe fields
		const updateData: Record<string, unknown> = {};
		if (updates.title !== undefined) updateData.title = updates.title;
		if (updates.description !== undefined) updateData.description = updates.description;
		if (updates.instructions !== undefined) updateData.instructions = updates.instructions;

		if (Object.keys(updateData).length > 0) {
			await this.recipeRepository.update(recipeId, updateData);
		}

		// Update ingredients if provided
		if (updates.ingredients !== undefined) {
			// Delete existing ingredients
			await this.recipeIngredientRepository.deleteByRecipeId(recipeId);

			// Insert new ingredients
			if (updates.ingredients.length > 0) {
				const ingredientValues: NewRecipeIngredientDao[] = updates.ingredients.map(
					(ing, index) => ({
						recipeId,
						name: ing.name,
						quantity: ing.quantity.toString(),
						unit: ing.unit,
						unitType: this.inferUnitType(ing.unit),
						optional: ing.optional || false,
						notes: ing.notes,
						orderIndex: index
					})
				);

				await this.recipeIngredientRepository.createMany(ingredientValues);
			}
		}

		// Return updated recipe
		const updatedRecipe = await this.getRecipe(recipeId, userId);
		if (!updatedRecipe) {
			throw new Error('Failed to retrieve updated recipe');
		}

		return updatedRecipe;
	}

	/**
	 * Adjust a recipe using AI based on natural language instruction
	 */
	async adjustRecipeWithAi(
		recipeId: string,
		userId: string,
		instruction: string
	): Promise<RecipeWithIngredients> {
		// Get current recipe
		const currentRecipe = await this.getRecipe(recipeId, userId);
		if (!currentRecipe) {
			throw new Error('Recipe not found or not authorized');
		}

		// Convert to GeneratedRecipe format for LLM
		const recipeForLLM = {
			title: currentRecipe.title,
			description: currentRecipe.description || '',
			instructions: currentRecipe.instructions,
			servings: currentRecipe.servings,
			prepTime: currentRecipe.prepTime || 0,
			cookTime: currentRecipe.cookTime || 0,
			cuisineType: currentRecipe.cuisineType || undefined,
			estimatedCalories: currentRecipe.estimatedCalories || undefined,
			ingredients: currentRecipe.ingredients.map((ing) => ({
				name: ing.name,
				quantity: parseFloat(ing.quantity) || 1,
				unit: ing.unit,
				optional: ing.optional || false,
				notes: ing.notes || undefined
			}))
		};

		// Call AI to adjust recipe
		const adjustedRecipe = await this.culinaryIntelligence.adjustRecipe(recipeForLLM, instruction);

		// Update the recipe in database
		await this.recipeRepository.update(recipeId, {
			title: adjustedRecipe.title,
			description: adjustedRecipe.description,
			instructions: adjustedRecipe.instructions,
			servings: adjustedRecipe.servings,
			prepTime: adjustedRecipe.prepTime,
			cookTime: adjustedRecipe.cookTime,
			cuisineType: adjustedRecipe.cuisineType,
			estimatedCalories: adjustedRecipe.estimatedCalories
		});

		// Delete existing ingredients and insert new ones
		await this.recipeIngredientRepository.deleteByRecipeId(recipeId);

		if (adjustedRecipe.ingredients.length > 0) {
			const ingredientValues: NewRecipeIngredientDao[] = adjustedRecipe.ingredients.map(
				(ing, index) => ({
					recipeId,
					name: ing.name,
					quantity: ing.quantity.toString(),
					unit: ing.unit,
					unitType: this.inferUnitType(ing.unit),
					optional: ing.optional || false,
					notes: ing.notes,
					orderIndex: index
				})
			);

			await this.recipeIngredientRepository.createMany(ingredientValues);
		}

		// Return updated recipe
		const result = await this.getRecipe(recipeId, userId);
		if (!result) {
			throw new Error('Failed to retrieve adjusted recipe');
		}

		return result;
	}
}
