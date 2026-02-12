import type { IImageGenerator } from './IImageGenerator';
import type { IVectorService } from './IVectorService';
import type { ICulinaryIntelligence } from './ICulinaryIntelligence';

export interface RecipeIngredient {
	id: string;
	recipeId: string;
	name: string;
	quantity: string;
	unit: string;
	unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	optional: boolean;
	notes: string | null;
	orderIndex: number;
}

export interface Recipe {
	id: string;
	userId: string;
	sourceReceiptId: string | null;
	title: string;
	description: string | null;
	instructions: string;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	imageUrl: string | null;
	imageStatus: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	source: 'GENERATED' | 'RAG' | 'USER';
	cuisineType: string | null;
	estimatedCalories: number | null;
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface RecipeWithIngredients extends Recipe {
	ingredients: RecipeIngredient[];
}

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

export interface GenerateRecipeInput {
	userId: string;
	ingredientIds?: string[];
	customIngredients?: string[];
	servings?: number;
	cuisineHint?: string;
	useRag?: boolean;
	sourceReceiptId?: string;
}

export interface UserPreferences {
	id: string;
	userId: string;
	allergies: string[];
	dietaryRestrictions: string[];
	cuisinePreferences: string[];
	excludedIngredients: string[];
	caloricGoal: number | null;
	defaultServings: number;
}

export interface TasteProfile {
	dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'halal' | 'kosher' | null;
	allergies: { allergen: string; severity: 'avoid' | 'severe' }[];
	ingredientPreferences: { ingredientName: string; preference: 'love' | 'like' | 'neutral' | 'dislike' | 'avoid' }[];
	cuisinePreferences: { cuisineType: string; preference: 'love' | 'like' | 'neutral' | 'dislike' }[];
}

export interface IRecipeService {
	generateRecipe(input: GenerateRecipeInput, preferences: UserPreferences | null, tasteProfile: TasteProfile | null): Promise<Recipe>;
	getRecipe(recipeId: string, viewerId?: string): Promise<RecipeWithIngredients | null>;
	getRecipeWithServings(recipeId: string, targetServings: number, userId?: string): Promise<RecipeWithIngredients | null>;
	getUserRecipes(userId: string, limit?: number): Promise<Recipe[]>;
	getUserRecipesWithIngredients(userId: string, limit?: number): Promise<RecipeWithIngredients[]>;
	getRecipesByReceiptId(receiptId: string): Promise<Recipe[]>;
	saveRecipe(userId: string, recipeId: string): Promise<void>;
	unsaveRecipe(userId: string, recipeId: string): Promise<void>;
	getSavedRecipes(userId: string): Promise<Recipe[]>;
	isSaved(userId: string, recipeId: string): Promise<boolean>;
	togglePublic(recipeId: string, userId: string): Promise<boolean>;
	deleteRecipe(recipeId: string, userId: string): Promise<void>;
	getImageStatus(recipeId: string): Promise<{ imageStatus: string | null; imageUrl: string | null } | null>;
	getReceiptCountByReceiptIds(receiptIds: string[]): Promise<Record<string, number>>;
	countUserRecipes(userId: string): Promise<number>;
	countSavedRecipes(userId: string): Promise<number>;
}
