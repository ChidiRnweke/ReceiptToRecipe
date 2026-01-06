import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ILlmService, GeneratedRecipe, RecipeContext, ChatMessage } from './interfaces';

const RECIPE_SYSTEM_PROMPT = `You are a helpful culinary assistant that creates recipes based on available ingredients.
When generating recipes:
1. Only use ingredients from the provided list, plus common pantry staples (salt, pepper, oil, basic spices)
2. Respect all dietary restrictions and allergies
3. Consider the specified cuisine preferences
4. Aim for the caloric goal if provided
5. Provide clear, step-by-step instructions
6. Include prep and cook times that are realistic

Always respond with valid JSON matching the requested format.`;

const NORMALIZE_SYSTEM_PROMPT = `You are a precise ingredient parser. Extract the quantity, unit, and ingredient name from the given string.
Normalize units:
- Weight: convert to grams (g). 1 lb = 453.592g, 1 oz = 28.3495g, 1 kg = 1000g
- Volume: convert to milliliters (ml). 1 cup = 236.588ml, 1 tbsp = 14.787ml, 1 tsp = 4.929ml, 1 L = 1000ml
- Count: keep as count for items measured by pieces (eggs, apples, etc.)

Always respond with valid JSON.`;

export class GeminiLlmService implements ILlmService {
	private client: GoogleGenerativeAI;
	private model: string;
	private embeddingModel: string;

	constructor(apiKey: string, model: string = 'gemini-1.5-flash', embeddingModel: string = 'text-embedding-004') {
		this.client = new GoogleGenerativeAI(apiKey);
		this.model = model;
		this.embeddingModel = embeddingModel;
	}

	async generateRecipe(context: RecipeContext): Promise<GeneratedRecipe> {
		const model = this.client.getGenerativeModel({
			model: this.model,
			generationConfig: {
				responseMimeType: 'application/json'
			}
		});

		const prompt = this.buildRecipePrompt(context);

		const result = await model.generateContent({
			contents: [
				{
					role: 'user',
					parts: [{ text: prompt }]
				}
			],
			systemInstruction: RECIPE_SYSTEM_PROMPT
		});

		const response = result.response.text();
		const recipe = JSON.parse(response) as GeneratedRecipe;

		return this.validateRecipe(recipe, context);
	}

	async normalizeIngredient(rawIngredient: string): Promise<{
		name: string;
		quantity: number;
		unit: string;
		unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	}> {
		const model = this.client.getGenerativeModel({
			model: this.model,
			generationConfig: {
				responseMimeType: 'application/json'
			}
		});

		const prompt = `Parse this ingredient string and extract the normalized quantity, unit, and name:
"${rawIngredient}"

Respond with JSON:
{
  "name": "ingredient name without quantity",
  "quantity": <number>,
  "unit": "g" | "ml" | "count",
  "unitType": "WEIGHT" | "VOLUME" | "COUNT"
}`;

		const result = await model.generateContent({
			contents: [
				{
					role: 'user',
					parts: [{ text: prompt }]
				}
			],
			systemInstruction: NORMALIZE_SYSTEM_PROMPT
		});

		return JSON.parse(result.response.text());
	}

	async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
		const model = this.client.getGenerativeModel({ model: this.model });

		const contents = messages.map((msg) => ({
			role: msg.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: msg.content }]
		}));

		const result = await model.generateContent({
			contents,
			systemInstruction: systemPrompt
		});

		return result.response.text();
	}

	async embed(text: string): Promise<number[]> {
		const model = this.client.getGenerativeModel({ model: this.embeddingModel });
		const result = await model.embedContent(text);
		return result.embedding.values;
	}

	private buildRecipePrompt(context: RecipeContext): string {
		const parts: string[] = [];

		parts.push('Generate a recipe using the following available ingredients:');
		parts.push(context.availableIngredients.join(', '));

		if (context.preferences.allergies?.length) {
			parts.push(`\nALLERGIES (MUST AVOID): ${context.preferences.allergies.join(', ')}`);
		}

		if (context.preferences.dietaryRestrictions?.length) {
			parts.push(`\nDietary restrictions: ${context.preferences.dietaryRestrictions.join(', ')}`);
		}

		if (context.preferences.excludedIngredients?.length) {
			parts.push(`\nDo not use these ingredients: ${context.preferences.excludedIngredients.join(', ')}`);
		}

		if (context.preferences.cuisinePreferences?.length) {
			parts.push(`\nPreferred cuisines: ${context.preferences.cuisinePreferences.join(', ')}`);
		}

		if (context.cuisineHint) {
			parts.push(`\nMake this a ${context.cuisineHint} style dish.`);
		}

		const servings = context.servings || context.preferences.defaultServings || 2;
		parts.push(`\nServings: ${servings}`);

		if (context.preferences.caloricGoal) {
			parts.push(`\nTarget approximately ${context.preferences.caloricGoal} calories per serving.`);
		}

		if (context.cookbookContext) {
			parts.push(`\nReference cookbook context:\n${context.cookbookContext}`);
		}

		parts.push(`\nRespond with JSON in this exact format:
{
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "instructions": "Step 1: ...\nStep 2: ...",
  "servings": ${servings},
  "prepTime": <minutes>,
  "cookTime": <minutes>,
  "cuisineType": "cuisine type",
  "estimatedCalories": <per serving>,
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": <number>,
      "unit": "g" | "ml" | "count" | "tbsp" | "tsp" | "cup",
      "optional": false,
      "notes": "optional preparation notes"
    }
  ]
}`);

		return parts.join('\n');
	}

	private validateRecipe(recipe: GeneratedRecipe, context: RecipeContext): GeneratedRecipe {
		// Ensure required fields
		if (!recipe.title) recipe.title = 'Untitled Recipe';
		if (!recipe.instructions) recipe.instructions = '';
		if (!recipe.servings) recipe.servings = context.servings || 2;
		if (!recipe.ingredients) recipe.ingredients = [];

		// Ensure ingredient structure
		recipe.ingredients = recipe.ingredients.map((ing) => ({
			name: ing.name || 'Unknown',
			quantity: ing.quantity || 1,
			unit: ing.unit || 'count',
			optional: ing.optional || false,
			notes: ing.notes
		}));

		return recipe;
	}
}
