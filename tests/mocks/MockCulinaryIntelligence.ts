import type {
	ICulinaryIntelligence,
	GeneratedRecipe,
	RecipeContext,
	ChatMessage,
	AllergyRiskReview,
	AllergyRiskReviewInput,
	CravingContext,
	ImageRecipe,
	ImageRecipeContext,
	RecipeImage
} from '../../src/lib/services/interfaces/ICulinaryIntelligence';

const FORMS = ['skillet', 'traybake', 'rice bowl'];

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
			ingredients: context.availableIngredients.map((name) => ({
				name,
				quantity: 1,
				unit: 'cup',
				optional: false
			}))
		};
	}

	/** A made-up recipe named after the craving; each excluded title moves on to another form. */
	async generateFromCraving(context: CravingContext): Promise<GeneratedRecipe> {
		const form = FORMS[context.excludeTitles.length % FORMS.length];
		const main = context.available[0] ?? 'chickpeas';
		return {
			title: `${main[0].toUpperCase()}${main.slice(1)} ${form}`,
			description: `Made up for "${context.text}"`,
			instructions: '',
			steps: [
				{ verb: 'Sweat', text: 'the onion with a pinch of salt, 5 min.', minutes: 5 },
				{ verb: 'Sauté', text: `the ${main} until golden, 6 min.`, minutes: 6 },
				{ verb: null, text: 'Season and serve.', minutes: null }
			],
			servings: context.servings,
			prepTime: 5,
			cookTime: 15,
			ingredients: [
				{ name: main, quantity: 200, unit: 'g', optional: false },
				{ name: 'onion', quantity: 1, unit: 'count', optional: false },
				{ name: 'salt', quantity: 1, unit: 'tsp', optional: false }
			]
		};
	}

	/** Reads every photo as a cookbook page with the same lemon chicken orzo. */
	async recipeFromImage(_image: RecipeImage, context: ImageRecipeContext): Promise<ImageRecipe> {
		return {
			kind: 'page',
			recipe: {
				title: 'Lemon chicken orzo',
				description: 'From a cookbook page',
				instructions: '',
				steps: [
					{ verb: 'Sear', text: 'the chicken until golden, 5 min a side.', minutes: 10 },
					{ verb: 'Simmer', text: 'the orzo in stock with lemon zest, 12 min.', minutes: 12 }
				],
				servings: context.servings,
				prepTime: 10,
				cookTime: 20,
				ingredients: [
					{ name: 'chicken thighs', quantity: 400, unit: 'g', optional: false },
					{ name: 'orzo', quantity: 200, unit: 'g', optional: false }
				]
			}
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

	async chat(messages: ChatMessage[]): Promise<string> {
		const key = messages.map((m) => m.content).join('|');
		return this.mockResponses.get(key) || 'Mock response';
	}

	async embed(): Promise<number[]> {
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

	async suggestModifications(): Promise<string[]> {
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
