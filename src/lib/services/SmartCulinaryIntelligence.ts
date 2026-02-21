import { OpenRouter } from '@openrouter/sdk';
import { z } from 'zod';
import type {
	ICulinaryIntelligence,
	GeneratedRecipe,
	RecipeContext,
	ChatMessage,
	AllergyRiskReview,
	AllergyRiskReviewInput
} from './interfaces';

const RECIPE_SYSTEM_PROMPT = `You are a helpful culinary assistant that creates recipes based on available ingredients.
When generating recipes:
1. Only use ingredients from the provided list, plus common kitchen staples (salt, pepper, oil, basic spices)
2. Respect all dietary restrictions and allergies
3. Consider the specified cuisine preferences
4. Aim for the caloric goal if provided
5. Provide clear, step-by-step instructions
6. Include prep and cook times that are realistic
7. Prioritize culinary coherence over ingredient coverage. Do NOT force all available ingredients into one dish.
8. Prefer a focused subset of compatible ingredients and ignore items that do not fit the same dish.

Always respond with valid JSON matching the requested format.`;

const ALLERGY_REVIEW_SYSTEM_PROMPT = `You are an allergy safety reviewer for recipes.
You must classify allergy risk for a specific user profile.

Risk levels:
- none: no meaningful allergy risk signals
- low: weak or uncertain mention only, no direct ingredient match
- medium: likely risk for at least one "avoid" allergy OR uncertain but concerning severe-allergy signal
- high: strong/direct risk for at least one severe allergy (explicit ingredient, common derivative, or obvious synonym)

Rules:
1. Be conservative for severe allergies.
2. Consider ingredient names, title, and instructions.
3. Return strict JSON only, no prose outside JSON.
4. confidence must be a number between 0 and 1.`;

const allergyRiskReviewSchema = z.object({
	riskLevel: z.enum(['none', 'low', 'medium', 'high']),
	triggers: z.array(z.string()).max(8),
	reasoning: z.string().min(1).max(600),
	confidence: z.number().min(0).max(1)
});

const NORMALIZE_SYSTEM_PROMPT = `You are a precise ingredient parser. Extract the quantity, unit, and ingredient name from the given string.
Normalize units:
- Weight: convert to grams (g). 1 lb = 453.592g, 1 oz = 28.3495g, 1 kg = 1000g
- Volume: convert to milliliters (ml). 1 cup = 236.588ml, 1 tbsp = 14.787ml, 1 tsp = 4.929ml, 1 L = 1000ml
- Count: keep as count for items measured by pieces (eggs, apples, etc.)

Always respond with valid JSON.`;

export class SmartCulinaryIntelligence implements ICulinaryIntelligence {
	private client: OpenRouter;
	private model: string;

	constructor(apiKey: string, model: string = 'google/gemini-3-flash-preview') {
		this.client = new OpenRouter({ apiKey });
		this.model = model;
	}

	async generateRecipe(context: RecipeContext): Promise<GeneratedRecipe> {
		const prompt = this.buildRecipePrompt(context);

		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [
					{
						role: 'system',
						content: RECIPE_SYSTEM_PROMPT
					},
					{
						role: 'user',
						content: prompt
					}
				],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});

		if (!completion || !('choices' in completion)) {
			throw new Error('Invalid response from OpenRouter');
		}

		const content = completion.choices[0].message.content;
		let responseText = '';

		if (typeof content === 'string') {
			responseText = content;
		} else if (Array.isArray(content)) {
			responseText = content
				.filter((part) => part.type === 'text')
				.map((part) => (part as any).text)
				.join('');
		}

		if (!responseText) {
			throw new Error('Empty response from OpenRouter');
		}
		const recipe = JSON.parse(responseText) as GeneratedRecipe;

		return this.validateRecipe(recipe, context);
	}

	async normalizeIngredient(rawIngredient: string): Promise<{
		name: string;
		quantity: number;
		unit: string;
		unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	}> {
		const prompt = `Parse this ingredient string and extract the normalized quantity, unit, and name:
"${rawIngredient}"

Respond with JSON:
{
  "name": "ingredient name without quantity",
  "quantity": <number>,
  "unit": "g" | "ml" | "count",
  "unitType": "WEIGHT" | "VOLUME" | "COUNT"
}`;

		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [
					{
						role: 'system',
						content: NORMALIZE_SYSTEM_PROMPT
					},
					{
						role: 'user',
						content: prompt
					}
				],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});

		if (!completion || !('choices' in completion)) {
			throw new Error('Invalid response from OpenRouter');
		}

		const content = completion.choices[0].message.content;
		let responseText = '';

		if (typeof content === 'string') {
			responseText = content;
		} else if (Array.isArray(content)) {
			responseText = content
				.filter((part) => part.type === 'text')
				.map((part) => (part as any).text)
				.join('');
		}

		if (!responseText) {
			throw new Error('Empty response from OpenRouter');
		}

		return JSON.parse(responseText);
	}

	async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
		const formattedMessages: any[] = messages.map((msg) => ({
			role: msg.role,
			content: msg.content
		}));

		if (systemPrompt) {
			formattedMessages.unshift({
				role: 'system',
				content: systemPrompt
			});
		}

		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: formattedMessages,
				stream: false
			}
		});

		if (!completion || !('choices' in completion)) {
			return '';
		}

		const content = completion.choices[0].message.content;
		let responseText = '';

		if (typeof content === 'string') {
			responseText = content;
		} else if (Array.isArray(content)) {
			responseText = content
				.filter((part) => part.type === 'text')
				.map((part) => (part as any).text)
				.join('');
		}

		return responseText || '';
	}

	async embed(text: string): Promise<number[]> {
		// Using OpenAI text-embedding-3-small as a standard embedding model via OpenRouter
		const model = 'openai/text-embedding-3-small';

		const response = await this.client.embeddings.generate({
			requestBody: {
				model: model,
				input: text
			}
		});

		if (typeof response === 'string') {
			throw new Error('Unexpected string response for embeddings');
		}

		if (!response.data || response.data.length === 0) {
			throw new Error('Failed to generate embedding');
		}

		const embedding = response.data[0].embedding;
		if (typeof embedding === 'string') {
			throw new Error('Received string embedding, expected number array');
		}

		return embedding;
	}

	private buildRecipePrompt(context: RecipeContext): string {
		const parts: string[] = [];
		const prioritized = this.prioritizeIngredients(context.availableIngredients);

		parts.push('Generate a recipe from the available pantry items below.');
		parts.push(
			`Use a coherent subset of ingredients. Do not use every available ingredient unless there are 5 or fewer and they naturally fit together.`
		);
		parts.push(`Target 4-8 primary ingredients for the main dish (plus basic staples as needed).`);
		parts.push('Primary ingredients to prioritize:');
		parts.push(prioritized.primary.join(', '));

		if (prioritized.optional.length > 0) {
			parts.push('\nOther available ingredients (optional, use only if they fit):');
			parts.push(prioritized.optional.join(', '));
		}

		// --- Taste Profile Constraints ---
		if (context.tasteProfile) {
			const { dietType, allergies, ingredientPreferences, cuisinePreferences } =
				context.tasteProfile;

			if (dietType) {
				parts.push(`\nCONSTRAINT: This recipe MUST be compatible with a ${dietType} diet.`);
			}

			const severeAllergies = allergies
				.filter((a) => a.severity === 'severe')
				.map((a) => a.allergen);
			const avoidAllergies = allergies.filter((a) => a.severity === 'avoid').map((a) => a.allergen);

			if (severeAllergies.length > 0) {
				parts.push(
					`\nCRITICAL SAFETY WARNING: Do NOT use ${severeAllergies.join(', ')} or any derivatives.`
				);
			}
			if (avoidAllergies.length > 0) {
				parts.push(`\nAllergies to avoid: ${avoidAllergies.join(', ')}`);
			}

			const disliked = ingredientPreferences
				.filter((p) => p.preference === 'dislike' || p.preference === 'avoid')
				.map((p) => p.ingredientName);
			if (disliked.length > 0) {
				parts.push(`\nAvoid using these ingredients: ${disliked.join(', ')}`);
			}

			const loved = ingredientPreferences
				.filter((p) => p.preference === 'love')
				.map((p) => p.ingredientName);
			if (loved.length > 0) {
				parts.push(
					`\nTry to incorporate these favorite ingredients if they fit: ${loved.join(', ')}`
				);
			}

			const lovedCuisines = cuisinePreferences
				.filter((c) => c.preference === 'love' || c.preference === 'like')
				.map((c) => c.cuisineType);
			if (lovedCuisines.length > 0 && !context.cuisineHint) {
				parts.push(`\nPreferred cuisines: ${lovedCuisines.join(', ')}`);
			}
		}

		// Fallback to legacy preferences if taste profile not set or specific fields missing
		if (!context.tasteProfile) {
			if (context.preferences.allergies?.length) {
				parts.push(`\nALLERGIES (MUST AVOID): ${context.preferences.allergies.join(', ')}`);
			}

			if (context.preferences.dietaryRestrictions?.length) {
				parts.push(`\nDietary restrictions: ${context.preferences.dietaryRestrictions.join(', ')}`);
			}

			if (context.preferences.excludedIngredients?.length) {
				parts.push(
					`\nDo not use these ingredients: ${context.preferences.excludedIngredients.join(', ')}`
				);
			}

			if (context.preferences.cuisinePreferences?.length) {
				parts.push(`\nPreferred cuisines: ${context.preferences.cuisinePreferences.join(', ')}`);
			}
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

	private prioritizeIngredients(ingredients: string[]): { primary: string[]; optional: string[] } {
		const normalizedUnique = Array.from(
			new Set(
				ingredients
					.map((ing) => ing.trim())
					.filter((ing) => ing.length > 0)
					.map((ing) => ing.toLowerCase())
			)
		);

		const scored = normalizedUnique.map((ingredient) => ({
			ingredient,
			score: this.scoreIngredientForRecipeFocus(ingredient)
		}));

		scored.sort((a, b) => b.score - a.score);

		const targetPrimaryCount = Math.min(8, Math.max(4, Math.ceil(scored.length * 0.55)));
		const primary = scored.slice(0, targetPrimaryCount).map((s) => s.ingredient);
		const optional = scored.slice(targetPrimaryCount).map((s) => s.ingredient);

		return {
			primary,
			optional
		};
	}

	private scoreIngredientForRecipeFocus(ingredient: string): number {
		const text = ingredient.toLowerCase();
		const lowPriorityPatterns = [
			/(chips?|crisps?|candy|chocolate bar|gum)/,
			/(soda|cola|tonic|sparkling water|energy drink)/,
			/(cookies?|biscuits?|snack)/
		];
		const highPriorityPatterns = [
			/(chicken|beef|pork|fish|salmon|tofu|beans?|lentils?|eggs?)/,
			/(rice|pasta|potato|noodle|bread|flour|quinoa|oats?)/,
			/(tomato|onion|garlic|pepper|carrot|broccoli|spinach|mushroom|zucchini)/,
			/(milk|cheese|yogurt|cream|butter)/
		];

		let score = 0;
		if (highPriorityPatterns.some((p) => p.test(text))) score += 3;
		if (lowPriorityPatterns.some((p) => p.test(text))) score -= 4;
		if (text.split(' ').length <= 3) score += 1;

		return score;
	}

	private validateRecipe(recipe: GeneratedRecipe, context: RecipeContext): GeneratedRecipe {
		// Ensure required fields
		if (!recipe.title) recipe.title = 'Untitled Recipe';
		if (!recipe.instructions) recipe.instructions = '';
		if (!recipe.servings)
			recipe.servings = context.servings || context.preferences.defaultServings || 2;
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

	async adjustRecipe(
		currentRecipe: GeneratedRecipe,
		instruction: string
	): Promise<GeneratedRecipe> {
		const prompt = `Modify the following recipe according to this instruction: "${instruction}"

Current Recipe:
Title: ${currentRecipe.title}
Description: ${currentRecipe.description}
Servings: ${currentRecipe.servings}
Prep Time: ${currentRecipe.prepTime} minutes
Cook Time: ${currentRecipe.cookTime} minutes
Cuisine: ${currentRecipe.cuisineType || 'Not specified'}
Estimated Calories: ${currentRecipe.estimatedCalories || 'Not specified'}

Ingredients:
${currentRecipe.ingredients.map((ing) => `- ${ing.quantity} ${ing.unit} ${ing.name}${ing.optional ? ' (optional)' : ''}${ing.notes ? ` - ${ing.notes}` : ''}`).join('\n')}

Instructions:
${currentRecipe.instructions}

Apply the requested changes while keeping the recipe coherent and delicious. Maintain the same JSON format.

Respond with JSON in this exact format:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "instructions": "Step 1: ...\\nStep 2: ...",
  "servings": <number>,
  "prepTime": <minutes>,
  "cookTime": <minutes>,
  "cuisineType": "cuisine",
  "estimatedCalories": <per serving>,
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": <number>,
      "unit": "g" | "ml" | "count" | "tbsp" | "tsp" | "cup",
      "optional": false,
      "notes": "optional notes"
    }
  ]
}`;

		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [
					{
						role: 'system',
						content: RECIPE_SYSTEM_PROMPT
					},
					{
						role: 'user',
						content: prompt
					}
				],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});

		if (!completion || !('choices' in completion)) {
			throw new Error('Empty response from OpenRouter');
		}

		const content = completion.choices[0].message.content;
		let responseText = '';

		if (typeof content === 'string') {
			responseText = content;
		} else if (Array.isArray(content)) {
			responseText = content
				.filter((part) => part.type === 'text')
				.map((part) => (part as any).text)
				.join('');
		}

		if (!responseText) {
			throw new Error('Empty response from OpenRouter');
		}

		const adjustedRecipe = JSON.parse(responseText) as GeneratedRecipe;

		// Basic validation
		if (!adjustedRecipe.title) adjustedRecipe.title = currentRecipe.title;
		if (!adjustedRecipe.ingredients) adjustedRecipe.ingredients = currentRecipe.ingredients;
		if (!adjustedRecipe.instructions) adjustedRecipe.instructions = currentRecipe.instructions;

		return adjustedRecipe;
	}

	async suggestModifications(recipe: GeneratedRecipe): Promise<string[]> {
		const prompt = `Based on the following recipe, suggest 3-4 short, practical modifications or variations a cook might want to make.
    
    Recipe: ${recipe.title}
    Ingredients: ${recipe.ingredients.map((i) => i.name).join(', ')}
    Cuisine: ${recipe.cuisineType || 'General'}
    
    Examples of good suggestions:
    - "Make it vegan" (if it has meat)
    - "Add more protein"
    - "Make it spicy"
    - "Use gluten-free alternative"
    - "Add roasted vegetables"
    
    Keep suggestions concise (max 5-6 words). Do NOT number them. Just return a JSON array of strings.
    
    Respond with JSON: ["suggestion 1", "suggestion 2", ...]`;

		try {
			const completion = await this.client.chat.send({
				chatGenerationParams: {
					model: this.model,
					messages: [
						{
							role: 'user',
							content: prompt
						}
					],
					responseFormat: { type: 'json_object' },
					stream: false
				}
			});

			if (!completion || !('choices' in completion)) {
				return [];
			}

			const content = completion.choices[0].message.content;
			let responseText = '';

			if (typeof content === 'string') {
				responseText = content;
			} else if (Array.isArray(content)) {
				responseText = content
					.filter((part) => part.type === 'text')
					.map((part) => (part as any).text)
					.join('');
			}

			if (!responseText) return [];

			const suggestions = JSON.parse(responseText);
			if (Array.isArray(suggestions)) {
				return suggestions.slice(0, 4); // Limit to 4 max
			}
			return [];
		} catch (error) {
			console.warn('Failed to generate recipe suggestions:', error);
			return []; // Fail gracefully with empty suggestions
		}
	}

	async reviewRecipeAllergyRisk(input: AllergyRiskReviewInput): Promise<AllergyRiskReview> {
		const combinedAllergies = [
			...input.allergies,
			...(input.legacyAllergies || []).map((allergen) => ({
				allergen,
				severity: 'avoid' as const
			}))
		];

		const uniqueByName = Array.from(
			new Map(combinedAllergies.map((a) => [a.allergen.toLowerCase(), a])).values()
		);

		if (uniqueByName.length === 0) {
			return {
				riskLevel: 'none',
				triggers: [],
				reasoning: 'No allergy settings were provided for this user.',
				confidence: 1
			};
		}

		const prompt = `Review this recipe for allergy risk.

User allergies:
${uniqueByName.map((a) => `- ${a.allergen} (severity: ${a.severity})`).join('\n')}

Recipe:
Title: ${input.recipe.title}
Description: ${input.recipe.description || 'N/A'}
Ingredients:
${input.recipe.ingredients.map((ing) => `- ${ing.name}`).join('\n')}
Instructions:
${input.recipe.instructions}

Return JSON:
{
  "riskLevel": "none" | "low" | "medium" | "high",
  "triggers": ["matched ingredient/allergen"],
  "reasoning": "short explanation",
  "confidence": 0.0
}`;

		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [
					{
						role: 'system',
						content: ALLERGY_REVIEW_SYSTEM_PROMPT
					},
					{
						role: 'user',
						content: prompt
					}
				],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});

		if (!completion || !('choices' in completion)) {
			throw new Error('Invalid response from OpenRouter');
		}

		const content = completion.choices[0].message.content;
		let responseText = '';

		if (typeof content === 'string') {
			responseText = content;
		} else if (Array.isArray(content)) {
			responseText = content
				.filter((part) => part.type === 'text')
				.map((part) => (part as any).text)
				.join('');
		}

		if (!responseText) {
			throw new Error('Empty allergy review response from OpenRouter');
		}

		const parsed = allergyRiskReviewSchema.parse(JSON.parse(responseText));

		return {
			riskLevel: parsed.riskLevel,
			triggers: parsed.triggers,
			reasoning: parsed.reasoning,
			confidence: parsed.confidence
		};
	}
}
