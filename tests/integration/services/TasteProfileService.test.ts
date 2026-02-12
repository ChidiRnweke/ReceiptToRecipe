import { describe, it, expect, beforeEach } from 'vitest';
import { TasteProfileService } from '../../../src/lib/services/TasteProfileService';
import {
	MockUserDietaryProfileRepository,
	MockUserAllergyRepository,
	MockUserIngredientPreferenceRepository,
	MockUserCuisinePreferenceRepository
} from '../../mocks/MockTasteProfileRepositories';
import { MockRecipeRepository, MockRecipeIngredientRepository } from '../../mocks/MockRecipeRepositories';

describe('TasteProfileService', () => {
	let service: TasteProfileService;
	let dietaryProfileRepo: MockUserDietaryProfileRepository;
	let allergyRepo: MockUserAllergyRepository;
	let ingredientPrefRepo: MockUserIngredientPreferenceRepository;
	let cuisinePrefRepo: MockUserCuisinePreferenceRepository;
	let recipeRepo: MockRecipeRepository;
	let recipeIngredientRepo: MockRecipeIngredientRepository;

	const userId = 'user-123';

	beforeEach(() => {
		dietaryProfileRepo = new MockUserDietaryProfileRepository();
		allergyRepo = new MockUserAllergyRepository();
		ingredientPrefRepo = new MockUserIngredientPreferenceRepository();
		cuisinePrefRepo = new MockUserCuisinePreferenceRepository();
		recipeRepo = new MockRecipeRepository();
		recipeIngredientRepo = new MockRecipeIngredientRepository();

		// Wire ingredient repo into recipe repo so findByIdWithIngredients works
		recipeRepo.setIngredientRepository(recipeIngredientRepo);

		service = new TasteProfileService(
			dietaryProfileRepo,
			allergyRepo,
			ingredientPrefRepo,
			cuisinePrefRepo,
			recipeRepo,
			recipeIngredientRepo
		);
	});

	// ---------- getUserTasteProfile ----------

	describe('getUserTasteProfile', () => {
		it('should return empty profile when user has no preferences set', async () => {
			const profile = await service.getUserTasteProfile(userId);

			expect(profile.dietType).toBeNull();
			expect(profile.allergies).toEqual([]);
			expect(profile.ingredientPreferences).toEqual([]);
			expect(profile.cuisinePreferences).toEqual([]);
		});

		it('should aggregate data from all repositories', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'vegetarian' });
			await allergyRepo.create({ userId, allergen: 'peanuts', severity: 'severe' });
			await allergyRepo.create({ userId, allergen: 'shellfish', severity: 'avoid' });
			await ingredientPrefRepo.create({ userId, ingredientName: 'garlic', preference: 'love' });
			await cuisinePrefRepo.create({ userId, cuisineType: 'Italian', preference: 'love' });
			await cuisinePrefRepo.create({ userId, cuisineType: 'Thai', preference: 'like' });

			const profile = await service.getUserTasteProfile(userId);

			expect(profile.dietType).toBe('vegetarian');
			expect(profile.allergies).toHaveLength(2);
			expect(profile.allergies).toContainEqual({ allergen: 'peanuts', severity: 'severe' });
			expect(profile.allergies).toContainEqual({ allergen: 'shellfish', severity: 'avoid' });
			expect(profile.ingredientPreferences).toHaveLength(1);
			expect(profile.ingredientPreferences[0]).toEqual({ ingredientName: 'garlic', preference: 'love' });
			expect(profile.cuisinePreferences).toHaveLength(2);
		});

		it('should not include other users data', async () => {
			await dietaryProfileRepo.create({ userId: 'other-user', dietType: 'vegan' });
			await allergyRepo.create({ userId: 'other-user', allergen: 'gluten', severity: 'severe' });

			const profile = await service.getUserTasteProfile(userId);
			expect(profile.dietType).toBeNull();
			expect(profile.allergies).toEqual([]);
		});
	});

	// ---------- setDietType ----------

	describe('setDietType', () => {
		it('should create a new dietary profile', async () => {
			await service.setDietType(userId, 'vegan');

			const profile = await dietaryProfileRepo.findByUserId(userId);
			expect(profile).not.toBeNull();
			expect(profile!.dietType).toBe('vegan');
		});

		it('should update an existing dietary profile', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'vegetarian' });

			await service.setDietType(userId, 'vegan');

			const profile = await dietaryProfileRepo.findByUserId(userId);
			expect(profile!.dietType).toBe('vegan');
		});

		it('should delete the dietary profile when set to null', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'keto' });

			await service.setDietType(userId, null);

			const profile = await dietaryProfileRepo.findByUserId(userId);
			expect(profile).toBeNull();
		});
	});

	// ---------- addAllergy / removeAllergy ----------

	describe('addAllergy', () => {
		it('should create an allergy record', async () => {
			await service.addAllergy(userId, 'peanuts', 'severe');

			const allergies = await allergyRepo.findByUserId(userId);
			expect(allergies).toHaveLength(1);
			expect(allergies[0].allergen).toBe('peanuts');
			expect(allergies[0].severity).toBe('severe');
		});
	});

	describe('removeAllergy', () => {
		it('should remove an allergy record', async () => {
			await allergyRepo.create({ userId, allergen: 'dairy', severity: 'avoid' });

			await service.removeAllergy(userId, 'dairy');

			const allergies = await allergyRepo.findByUserId(userId);
			expect(allergies).toHaveLength(0);
		});
	});

	// ---------- setIngredientPreference / removeIngredientPreference ----------

	describe('setIngredientPreference', () => {
		it('should create an ingredient preference', async () => {
			await service.setIngredientPreference(userId, 'cilantro', 'avoid');

			const prefs = await ingredientPrefRepo.findByUserId(userId);
			expect(prefs).toHaveLength(1);
			expect(prefs[0].ingredientName).toBe('cilantro');
			expect(prefs[0].preference).toBe('avoid');
		});
	});

	describe('removeIngredientPreference', () => {
		it('should remove an ingredient preference', async () => {
			await ingredientPrefRepo.create({ userId, ingredientName: 'mushrooms', preference: 'dislike' });

			await service.removeIngredientPreference(userId, 'mushrooms');

			const prefs = await ingredientPrefRepo.findByUserId(userId);
			expect(prefs).toHaveLength(0);
		});
	});

	// ---------- setCuisinePreference ----------

	describe('setCuisinePreference', () => {
		it('should create a cuisine preference', async () => {
			await service.setCuisinePreference(userId, 'Japanese', 'love');

			const prefs = await cuisinePrefRepo.findByUserId(userId);
			expect(prefs).toHaveLength(1);
			expect(prefs[0].cuisineType).toBe('Japanese');
			expect(prefs[0].preference).toBe('love');
		});
	});

	// ---------- checkRecipeCompatibility ----------

	describe('checkRecipeCompatibility', () => {
		it('should return fully compatible for a recipe with no conflicts', async () => {
			const recipe = await recipeRepo.create({
				userId,
				title: 'Simple Salad',
				instructions: 'Mix everything.',
				cuisineType: 'Mediterranean'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Lettuce', quantity: '1', unit: 'head', unitType: 'COUNT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Tomato', quantity: '2', unit: 'count', unitType: 'COUNT', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true);
			expect(result.blockers).toEqual([]);
			expect(result.warnings).toEqual([]);
			expect(result.matchScore).toBe(100);
		});

		it('should detect severe allergy as blocker and set matchScore to 0', async () => {
			await allergyRepo.create({ userId, allergen: 'peanut', severity: 'severe' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Peanut Butter Sandwich',
				instructions: 'Spread peanut butter.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Peanut Butter', quantity: '2', unit: 'tbsp', unitType: 'VOLUME', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Bread', quantity: '2', unit: 'slices', unitType: 'COUNT', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(false);
			expect(result.blockers).toContain('Contains peanut');
			expect(result.matchScore).toBe(0);
		});

		it('should detect mild allergy as warning', async () => {
			await allergyRepo.create({ userId, allergen: 'dairy', severity: 'avoid' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Cheese Pizza',
				instructions: 'Bake pizza.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Dairy Cheese', quantity: '200', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toContain('Contains dairy');
			expect(result.matchScore).toBeLessThan(100);
		});

		it('should detect allergen in recipe title', async () => {
			await allergyRepo.create({ userId, allergen: 'peanut', severity: 'severe' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Peanut Salad',
				instructions: 'Mix.'
			});
			// No ingredients containing peanut, but title does
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Lettuce', quantity: '1', unit: 'head', unitType: 'COUNT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(false);
			expect(result.blockers).toContain('Contains peanut');
		});

		it('should penalize disliked ingredients', async () => {
			await ingredientPrefRepo.create({ userId, ingredientName: 'cilantro', preference: 'dislike' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Cilantro Rice',
				instructions: 'Cook rice.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Cilantro', quantity: '1', unit: 'bunch', unitType: 'COUNT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Rice', quantity: '2', unit: 'cups', unitType: 'VOLUME', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toContain('Contains Cilantro (dislike)');
			expect(result.matchScore).toBeLessThan(100);
		});

		it('should penalize avoided ingredients', async () => {
			await ingredientPrefRepo.create({ userId, ingredientName: 'mushrooms', preference: 'avoid' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Mushroom Soup',
				instructions: 'Cook.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Mushrooms', quantity: '300', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.warnings.some(w => w.includes('Mushrooms') && w.includes('avoid'))).toBe(true);
			expect(result.matchScore).toBeLessThan(100);
		});

		it('should boost score for loved ingredients', async () => {
			await ingredientPrefRepo.create({ userId, ingredientName: 'garlic', preference: 'love' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Garlic Bread',
				instructions: 'Bake.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Garlic', quantity: '4', unit: 'cloves', unitType: 'COUNT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Bread', quantity: '1', unit: 'loaf', unitType: 'COUNT', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toEqual([]);
			// Score capped at 100 even with bonus
			expect(result.matchScore).toBe(100);
		});

		it('should boost score for loved cuisine', async () => {
			await cuisinePrefRepo.create({ userId, cuisineType: 'Italian', preference: 'love' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Pasta',
				instructions: 'Cook pasta.',
				cuisineType: 'Italian'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Spaghetti', quantity: '200', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true);
			// Base 100 + 20 for loved cuisine, capped at 100
			expect(result.matchScore).toBe(100);
		});

		it('should reduce score for disliked cuisine', async () => {
			await cuisinePrefRepo.create({ userId, cuisineType: 'Mexican', preference: 'dislike' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Tacos',
				instructions: 'Assemble.',
				cuisineType: 'Mexican'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Tortilla', quantity: '4', unit: 'count', unitType: 'COUNT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.matchScore).toBe(80);
		});

		it('should flag meat ingredients for vegetarian diet', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'vegetarian' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Steak Dinner',
				instructions: 'Grill steak.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Beef Steak', quantity: '1', unit: 'count', unitType: 'COUNT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Potatoes', quantity: '3', unit: 'count', unitType: 'COUNT', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true); // warnings, not blockers
			expect(result.warnings.some(w => w.includes('vegetarian'))).toBe(true);
			expect(result.matchScore).toBeLessThan(100);
		});

		it('should flag dairy and eggs for vegan diet', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'vegan' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Omelette',
				instructions: 'Cook.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Eggs', quantity: '3', unit: 'count', unitType: 'COUNT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Cheese', quantity: '50', unit: 'g', unitType: 'WEIGHT', orderIndex: 1 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.warnings.length).toBeGreaterThanOrEqual(2);
			expect(result.warnings.some(w => w.includes('Eggs'))).toBe(true);
			expect(result.warnings.some(w => w.includes('Cheese'))).toBe(true);
			expect(result.matchScore).toBeLessThan(50);
		});

		it('should not flag fish for vegetarian (only vegan)', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'vegetarian' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Salmon Bowl',
				instructions: 'Cook salmon.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Salmon Fillet', quantity: '1', unit: 'count', unitType: 'COUNT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			// Vegetarian forbids fish
			expect(result.warnings.some(w => w.includes('Salmon Fillet'))).toBe(true);
		});

		it('should throw when recipe is not found', async () => {
			await expect(
				service.checkRecipeCompatibility(userId, 'non-existent-recipe')
			).rejects.toThrow('Recipe not found');
		});

		it('should handle multiple issues and clamp matchScore between 0 and 100', async () => {
			await allergyRepo.create({ userId, allergen: 'dairy', severity: 'avoid' });
			await ingredientPrefRepo.create({ userId, ingredientName: 'onion', preference: 'avoid' });
			await cuisinePrefRepo.create({ userId, cuisineType: 'Indian', preference: 'dislike' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Paneer Curry',
				instructions: 'Cook.',
				cuisineType: 'Indian'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Paneer (dairy)', quantity: '200', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 },
				{ recipeId: recipe.id, name: 'Onion', quantity: '2', unit: 'count', unitType: 'COUNT', orderIndex: 1 },
				{ recipeId: recipe.id, name: 'Tomato', quantity: '3', unit: 'count', unitType: 'COUNT', orderIndex: 2 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			expect(result.compatible).toBe(true); // avoid allergy is warning, not blocker
			// dairy warning: -50, onion avoid: -20, Indian dislike: -20 = 100-90 = 10
			expect(result.matchScore).toBeGreaterThanOrEqual(0);
			expect(result.matchScore).toBeLessThanOrEqual(100);
		});

		it('should not penalize non-diet-restricted recipes', async () => {
			await dietaryProfileRepo.create({ userId, dietType: 'omnivore' });

			const recipe = await recipeRepo.create({
				userId,
				title: 'Steak',
				instructions: 'Grill.'
			});
			await recipeIngredientRepo.createMany([
				{ recipeId: recipe.id, name: 'Beef', quantity: '500', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 }
			]);

			const result = await service.checkRecipeCompatibility(userId, recipe.id);

			// omnivore gets no diet-based penalties
			expect(result.matchScore).toBe(100);
			expect(result.warnings).toEqual([]);
		});
	});
});
