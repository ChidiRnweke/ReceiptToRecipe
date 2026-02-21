import type {
	ICulinaryIntelligence,
	GeneratedRecipe,
	RecipeContext,
	ChatMessage,
	AllergyRiskReview,
	AllergyRiskReviewInput
} from '../../src/lib/services/interfaces/ICulinaryIntelligence';

/**
 * Mock implementation of ICulinaryIntelligence for testing
 */
export class MockCulinaryIntelligence implements ICulinaryIntelligence {
	private mockRecipes = new Map<string, GeneratedRecipe>();
	private mockResponses = new Map<string, string>();
	private defaultRecipe: GeneratedRecipe = {
		title: 'Mock Recipe',
		description: 'A delicious mock recipe for testing',
		instructions: '1. Step one\n2. Step two\n3. Enjoy!',
		servings: 2,
		prepTime: 10,
		cookTime: 20,
		cuisineType: 'Mock Cuisine',
		estimatedCalories: 400,
		ingredients: [{ name: 'Mock Ingredient', quantity: 1, unit: 'cup', optional: false }]
	};

	async generateRecipe(context: RecipeContext): Promise<GeneratedRecipe> {
		const key = context.availableIngredients.sort().join(',');
		const recipe = this.mockRecipes.get(key);
		if (recipe) {
			return { ...recipe };
		}
		// Return default recipe with context ingredients
		return {
			...this.defaultRecipe,
			ingredients: context.availableIngredients.map((name, index) => ({
				name,
				quantity: 1,
				unit: 'cup',
				optional: false
			}))
		};
	}

	async normalizeIngredient(rawIngredient: string): Promise<{
		name: string;
		quantity: number;
		unit: string;
		unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	}> {
		// Simple mock implementation
		return {
			name: rawIngredient.replace(/^\d+\s*/, '').trim(),
			quantity: 1,
			unit: 'cup',
			unitType: 'VOLUME'
		};
	}

	async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
		const key = messages.map((m) => m.content).join('|');
		return this.mockResponses.get(key) || 'Mock response';
	}

	async embed(text: string): Promise<number[]> {
		// Return mock 768-dimensional embedding
		return Array(768).fill(0.1);
	}

	async adjustRecipe(
		currentRecipe: GeneratedRecipe,
		instruction: string
	): Promise<GeneratedRecipe> {
		return {
			...currentRecipe,
			title: `${currentRecipe.title} (Adjusted)`,
			description: `${currentRecipe.description}\n\nAdjusted: ${instruction}`
		};
	}

	async suggestModifications(recipe: GeneratedRecipe): Promise<string[]> {
		return ['Make it vegan', 'Add more protein', 'Make it spicy'];
	}

	async reviewRecipeAllergyRisk(input: AllergyRiskReviewInput): Promise<AllergyRiskReview> {
		const allergyTerms = input.allergies.map((a) => a.allergen.toLowerCase());
		const ingredientText = input.recipe.ingredients.map((i) => i.name.toLowerCase()).join(' ');
		const triggers = allergyTerms.filter((term) => ingredientText.includes(term));

		return {
			riskLevel: triggers.length > 0 ? 'medium' : 'none',
			triggers,
			reasoning:
				triggers.length > 0
					? 'Matched one or more allergy terms in ingredient names.'
					: 'No allergy matches in ingredient names.',
			confidence: 0.75
		};
	}

	// Test helpers
	setMockRecipe(ingredientsKey: string, recipe: GeneratedRecipe): void {
		this.mockRecipes.set(ingredientsKey, recipe);
	}

	setMockResponse(messageKey: string, response: string): void {
		this.mockResponses.set(messageKey, response);
	}

	setDefaultRecipe(recipe: GeneratedRecipe): void {
		this.defaultRecipe = recipe;
	}

	clear(): void {
		this.mockRecipes.clear();
		this.mockResponses.clear();
	}
}
