import type { UserPreferences } from '$db/schema';
import type { TasteProfile } from '../TasteProfileService';

/** One step as the model writes it; the verb should come from the cooking vocabulary. */
export interface GeneratedStep {
	verb: string | null;
	text: string;
	minutes: number | null;
}

export interface GeneratedRecipe {
	title: string;
	description: string;
	/** The steps as text, one per line. Kept for code that reads recipes.instructions. */
	instructions: string;
	/** The steps in the cooking vocabulary; parsed from `instructions` when absent. */
	steps?: GeneratedStep[];
	servings: number;
	prepTime: number;
	cookTime: number;
	cuisineType?: string;
	estimatedCalories?: number;
	ingredients: {
		name: string;
		quantity: number;
		unit: string;
		optional: boolean;
		notes?: string;
	}[];
}

export interface RecipeContext {
	availableIngredients: string[];
	preferences: Partial<UserPreferences>;
	tasteProfile?: TasteProfile;
	servings?: number;
	cuisineHint?: string;
	cookbookContext?: string; // RAG context from cookbook
}

/** A craving or a list of what is in, turned into one recipe. */
export interface CravingContext {
	/** What the person typed, e.g. "something spicy, 20 minutes" or "eggs, spinach and feta". */
	text: string;
	/** What the kitchen holds now, by name. */
	available: string[];
	preferences: Partial<UserPreferences>;
	tasteProfile?: TasteProfile;
	/** Titles already offered for this craving, so "Another one" gives a different dish. */
	excludeTitles: string[];
	servings: number;
}

export interface RecipeImage {
	bytes: Uint8Array;
	mimeType: string;
}

export interface ImageRecipeContext {
	preferences: Partial<UserPreferences>;
	tasteProfile?: TasteProfile;
	servings: number;
}

/** What a photo showed and the recipe read from it. */
export interface ImageRecipe {
	kind: 'page' | 'screenshot' | 'dish';
	recipe: GeneratedRecipe;
}

export type AllergyRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface AllergyRiskReview {
	riskLevel: AllergyRiskLevel;
	triggers: string[];
	reasoning: string;
	confidence: number;
}

export interface AllergyRiskReviewInput {
	recipe: GeneratedRecipe;
	allergies: Array<{ allergen: string; severity: 'avoid' | 'severe' }>;
	legacyAllergies?: string[];
}

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ICulinaryIntelligence {
	/**
	 * Generate a recipe based on available ingredients and user preferences
	 * @param context - Recipe generation context
	 * @returns Generated recipe
	 */
	generateRecipe(context: RecipeContext): Promise<GeneratedRecipe>;

	/** Makes up one recipe for a craving, using what the kitchen holds where it fits. */
	generateFromCraving(context: CravingContext): Promise<GeneratedRecipe>;

	/**
	 * Reads a recipe from a photo: a cookbook page or card, a screenshot, or a dish to recreate.
	 * Throws `NoRecipeInImageError` when the photo shows neither.
	 */
	recipeFromImage(image: RecipeImage, context: ImageRecipeContext): Promise<ImageRecipe>;

	/**
	 * Normalize an ingredient string to extract quantity, unit, and name
	 * @param rawIngredient - Raw ingredient string (e.g., "1lb chicken breast")
	 * @returns Normalized ingredient data
	 */
	normalizeIngredient(rawIngredient: string): Promise<{
		name: string;
		quantity: number;
		unit: string;
		unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	}>;

	/**
	 * General chat completion for the culinary intelligence
	 * @param messages - Chat history
	 * @param systemPrompt - Optional system prompt
	 * @returns Assistant response
	 */
	chat(messages: ChatMessage[], systemPrompt?: string): Promise<string>;

	/**
	 * Generate text embeddings for RAG
	 * @param text - Text to embed
	 * @returns Embedding vector
	 */
	embed(text: string): Promise<number[]>;

	/**
	 * Adjust a recipe based on natural language instruction
	 * @param currentRecipe - The current recipe to modify
	 * @param instruction - Natural language instruction for changes
	 * @returns Adjusted recipe
	 */
	adjustRecipe(currentRecipe: GeneratedRecipe, instruction: string): Promise<GeneratedRecipe>;

	/**
	 * Suggest context-aware modifications for a recipe
	 * @param recipe - The recipe to generate suggestions for
	 * @returns Array of short suggestion strings (3-4 items)
	 */
	suggestModifications(recipe: GeneratedRecipe): Promise<string[]>;

	/**
	 * Review recipe for allergy risk using user settings
	 * @param input - Recipe and allergy settings
	 * @returns Structured risk review
	 */
	reviewRecipeAllergyRisk(input: AllergyRiskReviewInput): Promise<AllergyRiskReview>;
}

/** The photo shows no recipe and no dish. */
export class NoRecipeInImageError extends Error {
	constructor() {
		super('No recipe or dish found in the photo');
		this.name = 'NoRecipeInImageError';
	}
}
