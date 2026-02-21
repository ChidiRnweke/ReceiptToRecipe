import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartCulinaryIntelligence } from '../../../src/lib/services/SmartCulinaryIntelligence';

// Define hoisted mocks
const mocks = vi.hoisted(() => {
	return {
		send: vi.fn(),
		generate: vi.fn()
	};
});

// Mock the OpenRouter module
vi.mock('@openrouter/sdk', () => {
	return {
		OpenRouter: class {
			chat = { send: mocks.send };
			embeddings = { generate: mocks.generate };
		}
	};
});

describe('SmartCulinaryIntelligence', () => {
	let service: SmartCulinaryIntelligence;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new SmartCulinaryIntelligence('fake-key');
	});

	describe('generateRecipe', () => {
		const baseContext = {
			availableIngredients: ['Chicken', 'Rice'],
			preferences: {}
		};

		const mockRecipeResponse = (recipe: any) => {
			mocks.send.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify(recipe)
						}
					}
				]
			});
		};

		it('should include severe allergies in the prompt', async () => {
			mockRecipeResponse({});

			await service.generateRecipe({
				...baseContext,
				tasteProfile: {
					dietType: null,
					allergies: [
						{ allergen: 'Peanuts', severity: 'severe' },
						{ allergen: 'Dairy', severity: 'avoid' }
					],
					ingredientPreferences: [],
					cuisinePreferences: []
				}
			});

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).toContain('CRITICAL SAFETY WARNING: Do NOT use Peanuts');
			expect(prompt).toContain('Allergies to avoid: Dairy');
		});

		it('should include disliked ingredients in the prompt', async () => {
			mockRecipeResponse({});

			await service.generateRecipe({
				...baseContext,
				tasteProfile: {
					dietType: null,
					allergies: [],
					ingredientPreferences: [{ ingredientName: 'Mushrooms', preference: 'dislike' }],
					cuisinePreferences: []
				}
			});

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).toContain('Avoid using these ingredients: Mushrooms');
		});

		it('should fallback to legacy preferences when tasteProfile is missing', async () => {
			mockRecipeResponse({});

			await service.generateRecipe({
				...baseContext,
				preferences: {
					allergies: ['Shellfish'],
					dietaryRestrictions: ['Vegan'],
					excludedIngredients: ['Cilantro'],
					cuisinePreferences: ['Italian']
				}
			});

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).toContain('ALLERGIES (MUST AVOID): Shellfish');
			expect(prompt).toContain('Dietary restrictions: Vegan');
			expect(prompt).toContain('Do not use these ingredients: Cilantro');
			expect(prompt).toContain('Preferred cuisines: Italian');
		});

		it('should validate and fill missing recipe fields', async () => {
			// Mock partial response
			mockRecipeResponse({
				// Missing title, instructions
				servings: 4,
				description: 'A description',
				ingredients: [
					{ name: 'Chicken' } // Missing quantity/unit
				]
			});

			const result = await service.generateRecipe(baseContext);

			expect(result.title).toBe('Untitled Recipe');
			expect(result.instructions).toBe('');
			expect(result.servings).toBe(4);
			expect(result.ingredients[0].name).toBe('Chicken');
			expect(result.ingredients[0].quantity).toBe(1); // Default
			expect(result.ingredients[0].unit).toBe('count'); // Default
		});

		it('should use default servings when missing', async () => {
			mockRecipeResponse({});

			const result = await service.generateRecipe({
				...baseContext,
				preferences: { defaultServings: 6 }
			});

			expect(result.servings).toBe(6);
		});

		it('should use 2 servings when all else fails', async () => {
			mockRecipeResponse({});
			const result = await service.generateRecipe(baseContext);
			expect(result.servings).toBe(2);
		});

		it('should instruct model to use a coherent subset of ingredients', async () => {
			mockRecipeResponse({});

			await service.generateRecipe({
				availableIngredients: [
					'chicken',
					'rice',
					'broccoli',
					'garlic',
					'olive oil',
					'potato chips',
					'tonic water',
					'candy'
				],
				preferences: {}
			});

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).toContain('Use a coherent subset of ingredients');
			expect(prompt).toContain('Primary ingredients to prioritize:');
			expect(prompt).toContain('Other available ingredients (optional');
		});

		it('should include season hint in the prompt when season is provided', async () => {
			mockRecipeResponse({});

			await service.generateRecipe({
				...baseContext,
				season: 'summer'
			});

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).toContain('It is currently summer');
			expect(prompt).toContain('Prefer ingredients that are in season');
		});

		it('should not include season hint when season is not provided', async () => {
			mockRecipeResponse({});

			await service.generateRecipe(baseContext);

			const call = mocks.send.mock.calls[0][0];
			const prompt = call.chatGenerationParams.messages[1].content;

			expect(prompt).not.toContain('It is currently');
		});
	});

	describe('suggestModifications', () => {
		it('should return empty array gracefully on error', async () => {
			mocks.send.mockRejectedValue(new Error('API Error'));

			const result = await service.suggestModifications({
				title: 'Test',
				description: '',
				ingredients: [],
				instructions: '',
				servings: 2,
				prepTime: 10,
				cookTime: 10
			});

			expect(result).toEqual([]);
		});

		it('should limit suggestions to 4', async () => {
			mocks.send.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify(['1', '2', '3', '4', '5', '6'])
						}
					}
				]
			});

			const result = await service.suggestModifications({
				title: 'Test',
				description: '',
				ingredients: [],
				instructions: '',
				servings: 2,
				prepTime: 10,
				cookTime: 10
			});

			expect(result.length).toBe(4);
			expect(result).toEqual(['1', '2', '3', '4']);
		});
	});

	describe('reviewRecipeAllergyRisk', () => {
		it('should parse structured allergy risk review output', async () => {
			mocks.send.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify({
								riskLevel: 'high',
								triggers: ['peanuts'],
								reasoning: 'Peanut ingredient appears directly in recipe ingredients.',
								confidence: 0.96
							})
						}
					}
				]
			});

			const result = await service.reviewRecipeAllergyRisk({
				recipe: {
					title: 'Satay Bowl',
					description: 'Savory bowl',
					instructions: 'Mix and serve',
					servings: 2,
					prepTime: 10,
					cookTime: 15,
					ingredients: [{ name: 'peanut sauce', quantity: 2, unit: 'tbsp', optional: false }]
				},
				allergies: [{ allergen: 'peanuts', severity: 'severe' }],
				legacyAllergies: []
			});

			expect(result.riskLevel).toBe('high');
			expect(result.triggers).toContain('peanuts');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		it('should return none when no allergy settings are provided', async () => {
			const result = await service.reviewRecipeAllergyRisk({
				recipe: {
					title: 'Rice Bowl',
					description: 'Simple bowl',
					instructions: 'Cook rice',
					servings: 2,
					prepTime: 5,
					cookTime: 20,
					ingredients: [{ name: 'rice', quantity: 1, unit: 'cup', optional: false }]
				},
				allergies: [],
				legacyAllergies: []
			});

			expect(result.riskLevel).toBe('none');
			expect(result.triggers).toEqual([]);
		});
	});
});
