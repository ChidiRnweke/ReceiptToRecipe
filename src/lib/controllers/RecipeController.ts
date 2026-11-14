import type {
	IRecipeRepository,
	IRecipeIngredientRepository,
	ISavedRecipeRepository,
	IUserPreferencesRepository,
	IReceiptItemRepository
} from '$repositories';
import type {
	RecipeDao,
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
import type { Actor } from '$lib/models/household';

export interface GenerateRecipeInput {
	actor: Actor;
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
			actor,
			ingredientIds,
			customIngredients,
			servings,
			cuisineHint,
			useRag,
			sourceReceiptId
		} = input;

		// Preferences and taste profile belong to the person cooking, not the household
		const preferences = await this.userPreferencesRepository.findByUserId(actor.userId);
		const tasteProfile = await this.tasteProfileService.getUserTasteProfile(actor.userId);

		// Gather ingredients
		const ingredients: string[] = [...(customIngredients || [])];

		if (ingredientIds?.length) {
			const items = await this.receiptItemRepository.findByIdsInHousehold(
				ingredientIds,
				actor.householdId
			);
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
			actor,
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
		actor: Actor,
		generated: LlmGeneratedRecipe,
		source: 'GENERATED' | 'RAG' | 'USER',
		sourceReceiptId?: string
	): Promise<RecipeDao> {
		const recipe = await this.recipeRepository.create({
			userId: actor.userId,
			householdId: actor.householdId,
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
	 * Get recipe by ID with ingredients. Household recipes are visible to the household;
	 * public recipes are visible to anyone, signed in or not.
	 */
	async getRecipe(recipeId: string, actor?: Actor | null): Promise<RecipeWithIngredients | null> {
		const recipe = await this.recipeRepository.findByIdWithIngredients(recipeId);

		if (!recipe) return null;
		if (recipe.isPublic) return recipe;
		if (actor && recipe.householdId === actor.householdId) return recipe;

		return null;
	}

	/**
	 * Get recipe with adjusted servings
	 */
	async getRecipeWithServings(
		recipeId: string,
		targetServings: number,
		actor?: Actor | null
	): Promise<RecipeWithIngredients | null> {
		const recipe = await this.getRecipe(recipeId, actor);
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
	 * Get the household's recipes
	 */
	async getHouseholdRecipes(actor: Actor, limit: number = 20): Promise<RecipeDao[]> {
		return this.recipeRepository.findByHouseholdId(actor.householdId, limit);
	}

	/**
	 * Get the household's recipes with ingredients
	 */
	async getHouseholdRecipesWithIngredients(
		actor: Actor,
		limit: number = 20
	): Promise<RecipeWithIngredientsDao[]> {
		return this.recipeRepository.findByHouseholdIdWithIngredients(actor.householdId, limit);
	}

	/**
	 * Save/favorite a recipe (per person)
	 */
	async saveRecipe(actor: Actor, recipeId: string): Promise<void> {
		const recipe = await this.getRecipe(recipeId, actor);
		if (!recipe) {
			throw new Error('Recipe not found');
		}

		const existing = await this.savedRecipeRepository.findByUserAndRecipe(actor.userId, recipeId);
		if (!existing) {
			await this.savedRecipeRepository.create({ userId: actor.userId, recipeId });
		}
	}

	/**
	 * Unsave/unfavorite a recipe (per person)
	 */
	async unsaveRecipe(actor: Actor, recipeId: string): Promise<void> {
		await this.savedRecipeRepository.delete(actor.userId, recipeId);
	}

	/**
	 * Get the person's saved recipes that they can still see
	 */
	async getSavedRecipes(actor: Actor): Promise<RecipeDao[]> {
		const saved = await this.savedRecipeRepository.findByUserId(actor.userId);
		if (saved.length === 0) return [];

		const recipeIds = saved.map((s) => s.recipeId);
		const recipes = await this.recipeRepository.findByIds(recipeIds);
		return recipes.filter((recipe) => recipe.isPublic || recipe.householdId === actor.householdId);
	}

	/**
	 * Check if a recipe is saved by the person
	 */
	async isSaved(actor: Actor, recipeId: string): Promise<boolean> {
		return this.savedRecipeRepository.exists(actor.userId, recipeId);
	}

	/**
	 * Toggle recipe public/private
	 */
	async togglePublic(recipeId: string, actor: Actor): Promise<boolean> {
		const recipe = await this.recipeRepository.findById(recipeId);

		if (!recipe || recipe.householdId !== actor.householdId) {
			throw new Error('Recipe not found');
		}

		return this.recipeRepository.togglePublic(recipeId);
	}

	/**
	 * Delete a recipe
	 */
	async deleteRecipe(recipeId: string, actor: Actor): Promise<void> {
		const recipe = await this.recipeRepository.findById(recipeId);

		if (!recipe || recipe.householdId !== actor.householdId) {
			throw new Error('Recipe not found');
		}

		await this.recipeRepository.delete(recipeId);
	}

	/**
	 * Get recipe image status (for polling)
	 */
	async getImageStatus(
		recipeId: string,
		actor?: Actor | null
	): Promise<{ imageStatus: string | null; imageUrl: string | null } | null> {
		const recipe = await this.recipeRepository.findById(recipeId);
		if (!recipe) return null;
		if (!recipe.isPublic && recipe.householdId !== actor?.householdId) return null;

		return this.recipeRepository.getImageStatus(recipeId);
	}

	/**
	 * Update a recipe with adjusted ingredients and instructions
	 */
	async updateRecipe(
		recipeId: string,
		actor: Actor,
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

		if (!recipe || recipe.householdId !== actor.householdId) {
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
		const updatedRecipe = await this.getRecipe(recipeId, actor);
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
		actor: Actor,
		instruction: string
	): Promise<RecipeWithIngredients> {
		// Get current recipe; only the household may change it, even when it is public
		const currentRecipe = await this.getRecipe(recipeId, actor);
		if (!currentRecipe || currentRecipe.householdId !== actor.householdId) {
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
		const result = await this.getRecipe(recipeId, actor);
		if (!result) {
			throw new Error('Failed to retrieve adjusted recipe');
		}

		return result;
	}
}
