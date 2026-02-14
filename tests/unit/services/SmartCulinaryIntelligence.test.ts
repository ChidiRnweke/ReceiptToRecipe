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
});
