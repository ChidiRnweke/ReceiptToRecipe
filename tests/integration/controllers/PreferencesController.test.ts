import { describe, it, expect, beforeEach } from 'vitest';
import { PreferencesController } from '../../../src/lib/controllers/PreferencesController';
import { MockUserPreferencesRepository } from '../../mocks/MockUserPreferencesRepository';

describe('PreferencesController', () => {
	let controller: PreferencesController;
	let prefsRepo: MockUserPreferencesRepository;

	const userId = 'user-123';

	beforeEach(() => {
		prefsRepo = new MockUserPreferencesRepository();
		controller = new PreferencesController(prefsRepo);
	});

	describe('getPreferences', () => {
		it('should return null when no preferences exist', async () => {
			const result = await controller.getPreferences(userId);
			expect(result).toBeNull();
		});

		it('should return preferences when they exist', async () => {
			await prefsRepo.create({
				userId,
				allergies: ['peanuts'],
				defaultServings: 4
			});

			const result = await controller.getPreferences(userId);
			expect(result).not.toBeNull();
			expect(result!.userId).toBe(userId);
			expect(result!.allergies).toEqual(['peanuts']);
			expect(result!.defaultServings).toBe(4);
		});
	});

	describe('updatePreferences', () => {
		it('should create preferences when none exist', async () => {
			const result = await controller.updatePreferences(userId, {
				allergies: ['gluten'],
				defaultServings: 3
			});

			expect(result.userId).toBe(userId);
			expect(result.allergies).toEqual(['gluten']);
			expect(result.defaultServings).toBe(3);
		});

		it('should update existing preferences', async () => {
			await controller.updatePreferences(userId, {
				allergies: ['gluten'],
				defaultServings: 3
			});

			const result = await controller.updatePreferences(userId, {
				allergies: ['gluten', 'dairy'],
				defaultServings: 5
			});

			expect(result.allergies).toEqual(['gluten', 'dairy']);
			expect(result.defaultServings).toBe(5);
		});

		it('should preserve unspecified fields on update', async () => {
			await controller.updatePreferences(userId, {
				allergies: ['gluten'],
				cuisinePreferences: ['italian'],
				defaultServings: 3
			});

			const result = await controller.updatePreferences(userId, {
				allergies: ['gluten', 'dairy']
			});

			expect(result.allergies).toEqual(['gluten', 'dairy']);
			expect(result.cuisinePreferences).toEqual(['italian']);
			expect(result.defaultServings).toBe(3);
		});
	});

	describe('addAllergy', () => {
		it('should add an allergy to empty list', async () => {
			const result = await controller.addAllergy(userId, 'peanuts');
			expect(result.allergies).toEqual(['peanuts']);
		});

		it('should add an allergy to existing list', async () => {
			await controller.updatePreferences(userId, { allergies: ['gluten'] });

			const result = await controller.addAllergy(userId, 'dairy');
			expect(result.allergies).toEqual(['gluten', 'dairy']);
		});

		it('should not duplicate an existing allergy', async () => {
			await controller.updatePreferences(userId, { allergies: ['peanuts'] });

			const result = await controller.addAllergy(userId, 'peanuts');
			expect(result.allergies).toEqual(['peanuts']);
		});
	});

	describe('removeAllergy', () => {
		it('should remove an allergy from the list', async () => {
			await controller.updatePreferences(userId, { allergies: ['peanuts', 'dairy'] });

			const result = await controller.removeAllergy(userId, 'peanuts');
			expect(result.allergies).toEqual(['dairy']);
		});

		it('should handle removing non-existent allergy gracefully', async () => {
			await controller.updatePreferences(userId, { allergies: ['peanuts'] });

			const result = await controller.removeAllergy(userId, 'gluten');
			expect(result.allergies).toEqual(['peanuts']);
		});

		it('should handle removing from empty preferences', async () => {
			const result = await controller.removeAllergy(userId, 'peanuts');
			expect(result.allergies).toEqual([]);
		});
	});

	describe('addDietaryRestriction', () => {
		it('should add a dietary restriction', async () => {
			const result = await controller.addDietaryRestriction(userId, 'vegan');
			expect(result.dietaryRestrictions).toEqual(['vegan']);
		});

		it('should not duplicate an existing restriction', async () => {
			await controller.updatePreferences(userId, { dietaryRestrictions: ['vegan'] });

			const result = await controller.addDietaryRestriction(userId, 'vegan');
			expect(result.dietaryRestrictions).toEqual(['vegan']);
		});

		it('should append to existing restrictions', async () => {
			await controller.updatePreferences(userId, { dietaryRestrictions: ['vegan'] });

			const result = await controller.addDietaryRestriction(userId, 'gluten-free');
			expect(result.dietaryRestrictions).toEqual(['vegan', 'gluten-free']);
		});
	});

	describe('removeDietaryRestriction', () => {
		it('should remove a dietary restriction', async () => {
			await controller.updatePreferences(userId, { dietaryRestrictions: ['vegan', 'keto'] });

			const result = await controller.removeDietaryRestriction(userId, 'vegan');
			expect(result.dietaryRestrictions).toEqual(['keto']);
		});

		it('should handle removing non-existent restriction', async () => {
			await controller.updatePreferences(userId, { dietaryRestrictions: ['vegan'] });

			const result = await controller.removeDietaryRestriction(userId, 'keto');
			expect(result.dietaryRestrictions).toEqual(['vegan']);
		});
	});

	describe('addExcludedIngredient', () => {
		it('should add an excluded ingredient', async () => {
			const result = await controller.addExcludedIngredient(userId, 'cilantro');
			expect(result.excludedIngredients).toEqual(['cilantro']);
		});

		it('should not duplicate an existing exclusion', async () => {
			await controller.updatePreferences(userId, { excludedIngredients: ['cilantro'] });

			const result = await controller.addExcludedIngredient(userId, 'cilantro');
			expect(result.excludedIngredients).toEqual(['cilantro']);
		});

		it('should append to existing exclusions', async () => {
			await controller.updatePreferences(userId, { excludedIngredients: ['cilantro'] });

			const result = await controller.addExcludedIngredient(userId, 'olives');
			expect(result.excludedIngredients).toEqual(['cilantro', 'olives']);
		});
	});

	describe('removeExcludedIngredient', () => {
		it('should remove an excluded ingredient', async () => {
			await controller.updatePreferences(userId, { excludedIngredients: ['cilantro', 'olives'] });

			const result = await controller.removeExcludedIngredient(userId, 'cilantro');
			expect(result.excludedIngredients).toEqual(['olives']);
		});

		it('should handle removing non-existent ingredient', async () => {
			await controller.updatePreferences(userId, { excludedIngredients: ['cilantro'] });

			const result = await controller.removeExcludedIngredient(userId, 'olives');
			expect(result.excludedIngredients).toEqual(['cilantro']);
		});
	});

	describe('setCuisinePreferences', () => {
		it('should set cuisine preferences', async () => {
			const result = await controller.setCuisinePreferences(userId, ['italian', 'japanese']);
			expect(result.cuisinePreferences).toEqual(['italian', 'japanese']);
		});

		it('should replace existing cuisine preferences', async () => {
			await controller.updatePreferences(userId, { cuisinePreferences: ['italian'] });

			const result = await controller.setCuisinePreferences(userId, ['thai', 'mexican']);
			expect(result.cuisinePreferences).toEqual(['thai', 'mexican']);
		});

		it('should allow setting empty cuisine preferences', async () => {
			await controller.updatePreferences(userId, { cuisinePreferences: ['italian'] });

			const result = await controller.setCuisinePreferences(userId, []);
			expect(result.cuisinePreferences).toEqual([]);
		});
	});

	describe('setCaloricGoal', () => {
		it('should set a caloric goal', async () => {
			const result = await controller.setCaloricGoal(userId, 2000);
			expect(result.caloricGoal).toBe(2000);
		});

		it('should update an existing caloric goal', async () => {
			await controller.updatePreferences(userId, { caloricGoal: 2000 });

			const result = await controller.setCaloricGoal(userId, 1500);
			expect(result.caloricGoal).toBe(1500);
		});

		it('should allow setting caloric goal to null', async () => {
			await controller.updatePreferences(userId, { caloricGoal: 2000 });

			const result = await controller.setCaloricGoal(userId, null);
			expect(result.caloricGoal).toBeNull();
		});
	});

	describe('setDefaultServings', () => {
		it('should set default servings', async () => {
			const result = await controller.setDefaultServings(userId, 4);
			expect(result.defaultServings).toBe(4);
		});

		it('should update existing default servings', async () => {
			await controller.updatePreferences(userId, { defaultServings: 4 });

			const result = await controller.setDefaultServings(userId, 6);
			expect(result.defaultServings).toBe(6);
		});
	});
});
