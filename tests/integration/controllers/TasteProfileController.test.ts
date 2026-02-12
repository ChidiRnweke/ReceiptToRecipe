import { describe, it, expect, beforeEach } from 'vitest';
import { TasteProfileController } from '../../../src/lib/controllers/TasteProfileController';
import { MockTasteProfileService } from '../../mocks';

describe('TasteProfileController', () => {
	let controller: TasteProfileController;
	let mockService: MockTasteProfileService;

	beforeEach(() => {
		mockService = new MockTasteProfileService();
		controller = new TasteProfileController(mockService);
	});

	describe('getProfile', () => {
		it('should delegate to service and return default profile for new user', async () => {
			const profile = await controller.getProfile('user-1');

			expect(profile).toEqual({
				dietType: null,
				allergies: [],
				ingredientPreferences: [],
				cuisinePreferences: []
			});
		});

		it('should return profile set via service', async () => {
			mockService.setProfile('user-1', {
				dietType: 'vegan',
				allergies: [{ allergen: 'peanuts', severity: 'severe' }],
				ingredientPreferences: [{ ingredientName: 'tofu', preference: 'love' }],
				cuisinePreferences: [{ cuisineType: 'Japanese', preference: 'love' }]
			});

			const profile = await controller.getProfile('user-1');

			expect(profile.dietType).toBe('vegan');
			expect(profile.allergies).toHaveLength(1);
			expect(profile.allergies[0].allergen).toBe('peanuts');
			expect(profile.ingredientPreferences[0].ingredientName).toBe('tofu');
			expect(profile.cuisinePreferences[0].cuisineType).toBe('Japanese');
		});
	});

	describe('setDietType', () => {
		it('should delegate to service to set diet type', async () => {
			await controller.setDietType('user-1', 'vegetarian');

			const profile = await controller.getProfile('user-1');
			expect(profile.dietType).toBe('vegetarian');
		});

		it('should allow clearing diet type with null', async () => {
			await controller.setDietType('user-1', 'vegan');
			await controller.setDietType('user-1', null);

			const profile = await controller.getProfile('user-1');
			expect(profile.dietType).toBeNull();
		});
	});

	describe('addAllergy', () => {
		it('should delegate to service to add allergy', async () => {
			await controller.addAllergy('user-1', 'peanuts', 'severe');

			const profile = await controller.getProfile('user-1');
			expect(profile.allergies).toHaveLength(1);
			expect(profile.allergies[0]).toEqual({ allergen: 'peanuts', severity: 'severe' });
		});

		it('should add multiple allergies', async () => {
			await controller.addAllergy('user-1', 'peanuts', 'severe');
			await controller.addAllergy('user-1', 'shellfish', 'avoid');

			const profile = await controller.getProfile('user-1');
			expect(profile.allergies).toHaveLength(2);
		});
	});

	describe('removeAllergy', () => {
		it('should delegate to service to remove allergy', async () => {
			await controller.addAllergy('user-1', 'peanuts', 'severe');
			await controller.addAllergy('user-1', 'shellfish', 'avoid');

			await controller.removeAllergy('user-1', 'peanuts');

			const profile = await controller.getProfile('user-1');
			expect(profile.allergies).toHaveLength(1);
			expect(profile.allergies[0].allergen).toBe('shellfish');
		});

		it('should handle removing non-existent allergy gracefully', async () => {
			await controller.removeAllergy('user-1', 'peanuts');

			const profile = await controller.getProfile('user-1');
			expect(profile.allergies).toHaveLength(0);
		});
	});

	describe('setIngredientPreference', () => {
		it('should delegate to service to set ingredient preference', async () => {
			await controller.setIngredientPreference('user-1', 'tofu', 'love');

			const profile = await controller.getProfile('user-1');
			expect(profile.ingredientPreferences).toHaveLength(1);
			expect(profile.ingredientPreferences[0]).toEqual({
				ingredientName: 'tofu',
				preference: 'love'
			});
		});

		it('should update existing preference for same ingredient', async () => {
			await controller.setIngredientPreference('user-1', 'tofu', 'love');
			await controller.setIngredientPreference('user-1', 'tofu', 'dislike');

			const profile = await controller.getProfile('user-1');
			expect(profile.ingredientPreferences).toHaveLength(1);
			expect(profile.ingredientPreferences[0].preference).toBe('dislike');
		});
	});

	describe('removeIngredientPreference', () => {
		it('should delegate to service to remove ingredient preference', async () => {
			await controller.setIngredientPreference('user-1', 'tofu', 'love');
			await controller.setIngredientPreference('user-1', 'mushrooms', 'avoid');

			await controller.removeIngredientPreference('user-1', 'tofu');

			const profile = await controller.getProfile('user-1');
			expect(profile.ingredientPreferences).toHaveLength(1);
			expect(profile.ingredientPreferences[0].ingredientName).toBe('mushrooms');
		});
	});

	describe('setCuisinePreference', () => {
		it('should delegate to service to set cuisine preference', async () => {
			await controller.setCuisinePreference('user-1', 'Italian', 'love');

			const profile = await controller.getProfile('user-1');
			expect(profile.cuisinePreferences).toHaveLength(1);
			expect(profile.cuisinePreferences[0]).toEqual({
				cuisineType: 'Italian',
				preference: 'love'
			});
		});

		it('should update existing preference for same cuisine', async () => {
			await controller.setCuisinePreference('user-1', 'Italian', 'love');
			await controller.setCuisinePreference('user-1', 'Italian', 'dislike');

			const profile = await controller.getProfile('user-1');
			expect(profile.cuisinePreferences).toHaveLength(1);
			expect(profile.cuisinePreferences[0].preference).toBe('dislike');
		});
	});

	describe('checkCompatibility', () => {
		it('should delegate to service and return default compatible result', async () => {
			const result = await controller.checkCompatibility('user-1', 'recipe-1');

			expect(result.compatible).toBe(true);
			expect(result.warnings).toEqual([]);
			expect(result.blockers).toEqual([]);
			expect(result.matchScore).toBe(100);
		});

		it('should return configured incompatible result', async () => {
			mockService.setCompatibility('user-1', 'recipe-1', {
				compatible: false,
				warnings: ['Contains dairy'],
				blockers: ['Contains peanuts (severe allergy)'],
				matchScore: 0
			});

			const result = await controller.checkCompatibility('user-1', 'recipe-1');

			expect(result.compatible).toBe(false);
			expect(result.blockers).toContain('Contains peanuts (severe allergy)');
			expect(result.warnings).toContain('Contains dairy');
			expect(result.matchScore).toBe(0);
		});
	});
});
