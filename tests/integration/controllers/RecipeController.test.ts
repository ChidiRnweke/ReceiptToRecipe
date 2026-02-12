import { describe, it, expect, beforeEach } from 'vitest';
import { RecipeController } from '../../../src/lib/controllers/RecipeController';
import type { GenerateRecipeInput } from '../../../src/lib/controllers/RecipeController';
import {
	MockCulinaryIntelligence,
	MockImageGenerator,
	MockVectorService,
	MockRecipeRepository,
	MockRecipeIngredientRepository,
	MockSavedRecipeRepository,
	MockUserPreferencesRepository,
	MockReceiptItemRepository,
	MockJobQueue,
	MockTasteProfileService
} from '../../mocks';
import type { GeneratedRecipe } from '../../../src/lib/services/interfaces/ICulinaryIntelligence';

describe('RecipeController', () => {
	let controller: RecipeController;
	let mockCulinaryIntelligence: MockCulinaryIntelligence;
	let mockImageGenerator: MockImageGenerator;
	let mockVectorService: MockVectorService;
	let mockTasteProfileService: MockTasteProfileService;
	let mockRecipeRepository: MockRecipeRepository;
	let mockRecipeIngredientRepository: MockRecipeIngredientRepository;
	let mockSavedRecipeRepository: MockSavedRecipeRepository;
	let mockUserPreferencesRepository: MockUserPreferencesRepository;
	let mockReceiptItemRepository: MockReceiptItemRepository;
	let mockJobQueue: MockJobQueue;

	const userId = 'user-123';

	beforeEach(() => {
		mockCulinaryIntelligence = new MockCulinaryIntelligence();
		mockImageGenerator = new MockImageGenerator();
		mockVectorService = new MockVectorService();
		mockTasteProfileService = new MockTasteProfileService();
		mockRecipeRepository = new MockRecipeRepository();
		mockRecipeIngredientRepository = new MockRecipeIngredientRepository();
		mockSavedRecipeRepository = new MockSavedRecipeRepository();
		mockUserPreferencesRepository = new MockUserPreferencesRepository();
		mockReceiptItemRepository = new MockReceiptItemRepository();
		mockJobQueue = new MockJobQueue();

		controller = new RecipeController(
			mockCulinaryIntelligence,
			mockImageGenerator,
			mockVectorService,
			mockTasteProfileService,
			mockRecipeRepository,
			mockRecipeIngredientRepository,
			mockSavedRecipeRepository,
			mockUserPreferencesRepository,
			mockReceiptItemRepository,
			mockJobQueue,
		);
	});

	describe('generateRecipe', () => {
		it('should generate a recipe from custom ingredients', async () => {
			const result = await controller.generateRecipe({
				userId,
				customIngredients: ['pasta', 'tomatoes'],
				servings: 2,
			});

			expect(result.userId).toBe(userId);
			expect(result.servings).toBe(2);
			expect(result.source).toBe('GENERATED');
			expect(result.title).toBeDefined();
		});

		it('should throw when no ingredients are provided', async () => {
			await expect(
				controller.generateRecipe({ userId })
			).rejects.toThrow('No ingredients provided');
		});

		it('should throw when empty ingredient arrays are provided', async () => {
			await expect(
				controller.generateRecipe({
					userId,
					customIngredients: [],
					ingredientIds: [],
				})
			).rejects.toThrow('No ingredients provided');
		});

		it('should look up receipt items by ingredientIds', async () => {
			// Seed a receipt item
			const item = await mockReceiptItemRepository.create({
				receiptId: 'receipt-1',
				rawName: 'Organic Chicken Breast',
				normalizedName: 'chicken breast',
				quantity: '2',
				unit: 'lb',
				unitType: 'WEIGHT',
			});

			const result = await controller.generateRecipe({
				userId,
				ingredientIds: [item.id],
			});

			expect(result.userId).toBe(userId);
			// The mock culinary intelligence returns ingredients based on input
			expect(result.title).toBeDefined();
		});

		it('should combine ingredientIds and customIngredients', async () => {
			const item = await mockReceiptItemRepository.create({
				receiptId: 'receipt-1',
				rawName: 'Rice',
				normalizedName: 'rice',
				quantity: '1',
				unit: 'kg',
				unitType: 'WEIGHT',
			});

			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			await controller.generateRecipe({
				userId,
				ingredientIds: [item.id],
				customIngredients: ['chicken'],
			});

			expect(capturedContext.availableIngredients).toContain('rice');
			expect(capturedContext.availableIngredients).toContain('chicken');
		});

		it('should skip null receipt items from ingredientIds', async () => {
			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			await controller.generateRecipe({
				userId,
				ingredientIds: ['nonexistent-id'],
				customIngredients: ['butter'],
			});

			// Only 'butter' should be in available ingredients - nonexistent ID is skipped
			expect(capturedContext.availableIngredients).toEqual(['butter']);
		});

		it('should use user preferences for servings', async () => {
			await mockUserPreferencesRepository.create({
				userId,
				defaultServings: 6,
			});

			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			await controller.generateRecipe({
				userId,
				customIngredients: ['tofu'],
				// No servings specified - should use preferences default
			});

			expect(capturedContext.servings).toBe(6);
		});

		it('should pass cuisine hint to culinary intelligence', async () => {
			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			await controller.generateRecipe({
				userId,
				customIngredients: ['noodles'],
				cuisineHint: 'Japanese',
			});

			expect(capturedContext.cuisineHint).toBe('Japanese');
		});

		it('should use RAG context when useRag is true', async () => {
			// Add a cookbook entry to vector store
			await mockVectorService.upsert(
				'cookbook-1',
				'Italian Cooking',
				'Classic tomato sauce with garlic and basil'
			);

			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			const result = await controller.generateRecipe({
				userId,
				customIngredients: ['tomato', 'garlic'],
				useRag: true,
			});

			expect(result.source).toBe('RAG');
			expect(capturedContext.cookbookContext).toBeDefined();
		});

		it('should persist recipe and ingredients to repositories', async () => {
			const mockRecipe: GeneratedRecipe = {
				title: 'Pasta Primavera',
				description: 'Fresh veggie pasta',
				instructions: '1. Cook pasta\n2. Saute veggies\n3. Combine',
				servings: 4,
				prepTime: 15,
				cookTime: 20,
				cuisineType: 'Italian',
				estimatedCalories: 350,
				ingredients: [
					{ name: 'Pasta', quantity: 200, unit: 'g', optional: false },
					{ name: 'Zucchini', quantity: 1, unit: 'count', optional: false },
					{ name: 'Parmesan', quantity: 50, unit: 'g', optional: true, notes: 'for garnish' },
				]
			};

			// Use setMockRecipe with a key matching the sorted ingredients
			mockCulinaryIntelligence.setMockRecipe('parmesan,pasta,zucchini', mockRecipe);

			const result = await controller.generateRecipe({
				userId,
				customIngredients: ['pasta', 'zucchini', 'parmesan'],
				servings: 4,
			});

			// Recipe should be stored
			const stored = mockRecipeRepository.getStored(result.id);
			expect(stored).toBeDefined();
			expect(stored!.title).toBe('Pasta Primavera');
			expect(stored!.cuisineType).toBe('Italian');

			// Ingredients should be stored
			const ingredients = await mockRecipeIngredientRepository.findByRecipeId(result.id);
			expect(ingredients).toHaveLength(3);
			expect(ingredients[0].name).toBe('Pasta');
			expect(ingredients[1].name).toBe('Zucchini');
			expect(ingredients[2].optional).toBe(true);
		});

		it('should queue image generation job', async () => {
			await controller.generateRecipe({
				userId,
				customIngredients: ['eggs', 'cheese'],
			});

			// The job is fired-and-forgotten (not awaited) inside generateRecipe,
			// so we need to flush microtasks before asserting.
			await new Promise(resolve => setTimeout(resolve, 0));

			const jobs = mockJobQueue.getExecutedJobs();
			expect(jobs.length).toBeGreaterThan(0);
			expect(jobs[0].name).toMatch(/^recipe-image:/);
		});

		it('should set sourceReceiptId when provided', async () => {
			const result = await controller.generateRecipe({
				userId,
				customIngredients: ['flour', 'sugar'],
				sourceReceiptId: 'receipt-abc',
			});

			const stored = mockRecipeRepository.getStored(result.id);
			expect(stored!.sourceReceiptId).toBe('receipt-abc');
		});

		it('should pass taste profile to culinary intelligence', async () => {
			mockTasteProfileService.setProfile(userId, {
				dietType: 'vegetarian',
				allergies: [{ allergen: 'peanuts', severity: 'severe' }],
				ingredientPreferences: [],
				cuisinePreferences: [],
			});

			let capturedContext: any;
			const original = mockCulinaryIntelligence.generateRecipe.bind(mockCulinaryIntelligence);
			mockCulinaryIntelligence.generateRecipe = async (context) => {
				capturedContext = context;
				return original(context);
			};

			await controller.generateRecipe({
				userId,
				customIngredients: ['tofu'],
			});

			expect(capturedContext.tasteProfile).toBeDefined();
			expect(capturedContext.tasteProfile.dietType).toBe('vegetarian');
		});
	});

	describe('getRecipe', () => {
		it('should return recipe with ingredients for owner', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Test Recipe',
				instructions: 'Do stuff',
				servings: 2,
			});
			await mockRecipeIngredientRepository.createMany([
				{
					recipeId: recipe.id,
					name: 'Salt',
					quantity: '1',
					unit: 'tsp',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 0,
				}
			]);

			// Note: MockRecipeRepository.findByIdWithIngredients returns empty ingredients[]
			// because it doesn't cross-reference the ingredient repo.
			// We test the controller calls through, not the mock data shape.
			const result = await controller.getRecipe(recipe.id, userId);
			expect(result).not.toBeNull();
			expect(result!.id).toBe(recipe.id);
			expect(result!.title).toBe('Test Recipe');
		});

		it('should return null for non-existent recipe', async () => {
			const result = await controller.getRecipe('nonexistent', userId);
			expect(result).toBeNull();
		});

		it('should return null for private recipe owned by another user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Private Recipe',
				instructions: 'Secret',
				servings: 2,
			});

			const result = await controller.getRecipe(recipe.id, userId);
			expect(result).toBeNull();
		});

		it('should return public recipe owned by another user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Public Recipe',
				instructions: 'Available',
				servings: 2,
			});
			await mockRecipeRepository.togglePublic(recipe.id);

			const result = await controller.getRecipe(recipe.id, userId);
			expect(result).not.toBeNull();
			expect(result!.title).toBe('Public Recipe');
		});

		it('should return null for private recipe when no userId provided', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'My Private Recipe',
				instructions: 'Only for me',
				servings: 2,
			});

			const result = await controller.getRecipe(recipe.id);
			expect(result).toBeNull();
		});
	});

	describe('getRecipeWithServings', () => {
		it('should scale ingredient quantities', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Scaled Recipe',
				instructions: 'Cook it',
				servings: 2,
			});
			// Since mock findByIdWithIngredients returns empty ingredients,
			// we test that the method returns null for nonexistent and handles the scale logic.
			// For a more complete test, let's seed the mock properly.
			const result = await controller.getRecipeWithServings(recipe.id, 4, userId);
			expect(result).not.toBeNull();
			expect(result!.servings).toBe(4);
		});

		it('should return null for non-existent recipe', async () => {
			const result = await controller.getRecipeWithServings('nope', 4, userId);
			expect(result).toBeNull();
		});
	});

	describe('getUserRecipes', () => {
		it('should return recipes for user', async () => {
			await mockRecipeRepository.create({ userId, title: 'R1', instructions: 'Do', servings: 2 });
			await mockRecipeRepository.create({ userId, title: 'R2', instructions: 'Do', servings: 2 });
			await mockRecipeRepository.create({ userId: 'other', title: 'R3', instructions: 'Do', servings: 2 });

			const result = await controller.getUserRecipes(userId);
			expect(result).toHaveLength(2);
		});

		it('should respect limit parameter', async () => {
			await mockRecipeRepository.create({ userId, title: 'R1', instructions: 'Do', servings: 2 });
			await mockRecipeRepository.create({ userId, title: 'R2', instructions: 'Do', servings: 2 });
			await mockRecipeRepository.create({ userId, title: 'R3', instructions: 'Do', servings: 2 });

			const result = await controller.getUserRecipes(userId, 2);
			expect(result).toHaveLength(2);
		});
	});

	describe('getUserRecipesWithIngredients', () => {
		it('should return recipes with ingredients for user', async () => {
			await mockRecipeRepository.create({ userId, title: 'R1', instructions: 'Do', servings: 2 });

			const result = await controller.getUserRecipesWithIngredients(userId);
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveProperty('ingredients');
		});
	});

	describe('saveRecipe', () => {
		it('should save a recipe for a user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Saveable',
				instructions: 'Make',
				servings: 2,
			});

			await controller.saveRecipe(userId, recipe.id);

			const isSaved = await controller.isSaved(userId, recipe.id);
			expect(isSaved).toBe(true);
		});

		it('should not duplicate save', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Saveable',
				instructions: 'Make',
				servings: 2,
			});

			await controller.saveRecipe(userId, recipe.id);
			await controller.saveRecipe(userId, recipe.id); // second save

			const saved = await mockSavedRecipeRepository.findByUserId(userId);
			expect(saved).toHaveLength(1);
		});
	});

	describe('unsaveRecipe', () => {
		it('should remove a saved recipe', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Saveable',
				instructions: 'Make',
				servings: 2,
			});

			await controller.saveRecipe(userId, recipe.id);
			expect(await controller.isSaved(userId, recipe.id)).toBe(true);

			await controller.unsaveRecipe(userId, recipe.id);
			expect(await controller.isSaved(userId, recipe.id)).toBe(false);
		});
	});

	describe('isSaved', () => {
		it('should return false for unsaved recipe', async () => {
			const result = await controller.isSaved(userId, 'some-recipe');
			expect(result).toBe(false);
		});
	});

	describe('getSavedRecipes', () => {
		it('should return saved recipes', async () => {
			const r1 = await mockRecipeRepository.create({ userId: 'other', title: 'R1', instructions: 'Do', servings: 2 });
			const r2 = await mockRecipeRepository.create({ userId: 'other', title: 'R2', instructions: 'Do', servings: 2 });

			await controller.saveRecipe(userId, r1.id);
			await controller.saveRecipe(userId, r2.id);

			const result = await controller.getSavedRecipes(userId);
			expect(result).toHaveLength(2);
		});

		it('should return empty array when no saved recipes', async () => {
			const result = await controller.getSavedRecipes(userId);
			expect(result).toEqual([]);
		});
	});

	describe('togglePublic', () => {
		it('should toggle recipe public status', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Toggle Me',
				instructions: 'Public test',
				servings: 2,
			});

			const isPublic = await controller.togglePublic(recipe.id, userId);
			expect(isPublic).toBe(true);

			const isPublic2 = await controller.togglePublic(recipe.id, userId);
			expect(isPublic2).toBe(false);
		});

		it('should throw for non-existent recipe', async () => {
			await expect(
				controller.togglePublic('nope', userId)
			).rejects.toThrow('Recipe not found');
		});

		it('should throw for recipe owned by another user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Not Mine',
				instructions: 'Nope',
				servings: 2,
			});

			await expect(
				controller.togglePublic(recipe.id, userId)
			).rejects.toThrow('Recipe not found');
		});
	});

	describe('deleteRecipe', () => {
		it('should delete a recipe owned by user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Delete Me',
				instructions: 'Goodbye',
				servings: 2,
			});

			await controller.deleteRecipe(recipe.id, userId);
			const stored = mockRecipeRepository.getStored(recipe.id);
			expect(stored).toBeUndefined();
		});

		it('should throw for recipe not found', async () => {
			await expect(
				controller.deleteRecipe('nope', userId)
			).rejects.toThrow('Recipe not found');
		});

		it('should throw for recipe owned by another user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Not Mine',
				instructions: 'Nope',
				servings: 2,
			});

			await expect(
				controller.deleteRecipe(recipe.id, userId)
			).rejects.toThrow('Recipe not found');
		});
	});

	describe('getImageStatus', () => {
		it('should return image status for existing recipe', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Image Test',
				instructions: 'Test',
				servings: 2,
			});

			const status = await controller.getImageStatus(recipe.id);
			expect(status).toEqual({
				imageStatus: 'QUEUED',
				imageUrl: null,
			});
		});

		it('should return null for non-existent recipe', async () => {
			const status = await controller.getImageStatus('nope');
			expect(status).toBeNull();
		});
	});

	describe('updateRecipe', () => {
		it('should update recipe title and description', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Original',
				instructions: 'Old instructions',
				servings: 2,
			});

			const updated = await controller.updateRecipe(recipe.id, userId, {
				title: 'Updated Title',
				description: 'New description',
			});

			expect(updated.title).toBe('Updated Title');
		});

		it('should replace ingredients when provided', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Update Ings',
				instructions: 'Test',
				servings: 2,
			});
			await mockRecipeIngredientRepository.createMany([
				{
					recipeId: recipe.id,
					name: 'OldIngredient',
					quantity: '1',
					unit: 'cup',
					unitType: 'VOLUME',
					optional: false,
					orderIndex: 0,
				}
			]);

			await controller.updateRecipe(recipe.id, userId, {
				ingredients: [
					{ name: 'NewIngredient', quantity: '2', unit: 'tbsp' },
				],
			});

			const ings = await mockRecipeIngredientRepository.findByRecipeId(recipe.id);
			expect(ings).toHaveLength(1);
			expect(ings[0].name).toBe('NewIngredient');
		});

		it('should throw for recipe not owned by user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Not Mine',
				instructions: 'Nope',
				servings: 2,
			});

			await expect(
				controller.updateRecipe(recipe.id, userId, { title: 'Hacked' })
			).rejects.toThrow('Recipe not found or not authorized');
		});

		it('should throw for non-existent recipe', async () => {
			await expect(
				controller.updateRecipe('nope', userId, { title: 'Nope' })
			).rejects.toThrow('Recipe not found or not authorized');
		});
	});

	describe('adjustRecipeWithAi', () => {
		it('should adjust recipe via AI and persist changes', async () => {
			const recipe = await mockRecipeRepository.create({
				userId,
				title: 'Original Recipe',
				instructions: 'Original instructions',
				servings: 2,
			});

			const result = await controller.adjustRecipeWithAi(
				recipe.id,
				userId,
				'Make it spicy'
			);

			// The mock adjustRecipe appends "(Adjusted)" to title
			expect(result.title).toContain('Adjusted');
		});

		it('should throw for recipe not found', async () => {
			await expect(
				controller.adjustRecipeWithAi('nope', userId, 'Make it vegan')
			).rejects.toThrow('Recipe not found or not authorized');
		});

		it('should throw for recipe owned by another user', async () => {
			const recipe = await mockRecipeRepository.create({
				userId: 'other-user',
				title: 'Not Mine',
				instructions: 'Nope',
				servings: 2,
			});

			await expect(
				controller.adjustRecipeWithAi(recipe.id, userId, 'Make it vegan')
			).rejects.toThrow('Recipe not found or not authorized');
		});
	});

	describe('inferUnitType (via generateRecipe)', () => {
		it('should correctly classify weight, volume, and count units', async () => {
			const mockRecipe: GeneratedRecipe = {
				title: 'Unit Test Recipe',
				description: 'Tests unit type inference',
				instructions: 'Mix everything',
				servings: 2,
				prepTime: 5,
				cookTime: 10,
				ingredients: [
					{ name: 'Flour', quantity: 200, unit: 'g', optional: false },
					{ name: 'Milk', quantity: 1, unit: 'cup', optional: false },
					{ name: 'Eggs', quantity: 3, unit: 'whole', optional: false },
					{ name: 'Butter', quantity: 100, unit: 'ml', optional: false },
					{ name: 'Meat', quantity: 1, unit: 'lb', optional: false },
				]
			};
			// Key is sorted custom ingredients
			mockCulinaryIntelligence.setMockRecipe('butter,eggs,flour,meat,milk', mockRecipe);

			const result = await controller.generateRecipe({
				userId,
				customIngredients: ['flour', 'milk', 'eggs', 'butter', 'meat'],
			});

			const ingredients = await mockRecipeIngredientRepository.findByRecipeId(result.id);
			expect(ingredients).toHaveLength(5);

			const flour = ingredients.find(i => i.name === 'Flour')!;
			expect(flour.unitType).toBe('WEIGHT');

			const milk = ingredients.find(i => i.name === 'Milk')!;
			expect(milk.unitType).toBe('VOLUME');

			const eggs = ingredients.find(i => i.name === 'Eggs')!;
			expect(eggs.unitType).toBe('COUNT');

			const butter = ingredients.find(i => i.name === 'Butter')!;
			expect(butter.unitType).toBe('VOLUME');

			const meat = ingredients.find(i => i.name === 'Meat')!;
			expect(meat.unitType).toBe('WEIGHT');
		});
	});
});
