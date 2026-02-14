import type { UserPreferences } from "$db/schema";
import type { TasteProfile } from "../TasteProfileService";

export interface GeneratedRecipe {
  title: string;
  description: string;
  instructions: string;
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

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ICulinaryIntelligence {
  /**
   * Generate a recipe based on available ingredients and user preferences
   * @param context - Recipe generation context
   * @returns Generated recipe
   */
  generateRecipe(context: RecipeContext): Promise<GeneratedRecipe>;

  /**
   * Normalize an ingredient string to extract quantity, unit, and name
   * @param rawIngredient - Raw ingredient string (e.g., "1lb chicken breast")
   * @returns Normalized ingredient data
   */
  normalizeIngredient(rawIngredient: string): Promise<{
    name: string;
    quantity: number;
    unit: string;
    unitType: "WEIGHT" | "VOLUME" | "COUNT";
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
  adjustRecipe(
    currentRecipe: GeneratedRecipe,
    instruction: string,
  ): Promise<GeneratedRecipe>;

  /**
   * Suggest context-aware modifications for a recipe
   * @param recipe - The recipe to generate suggestions for
   * @returns Array of short suggestion strings (3-4 items)
   */
  suggestModifications(recipe: GeneratedRecipe): Promise<string[]>;
}
