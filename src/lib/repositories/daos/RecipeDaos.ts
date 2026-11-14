import type { RecipeSource, TechniqueVerb } from '$lib/models/recipes';

export interface RecipeDao {
	id: string;
	userId: string;
	householdId: string;
	sourceReceiptId: string | null;
	title: string;
	description: string | null;
	instructions: string;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	imageUrl: string | null;
	imageStatus: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	source: RecipeSource;
	cuisineType: string | null;
	estimatedCalories: number | null;
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewRecipeDao {
	userId: string;
	householdId: string;
	sourceReceiptId?: string | null;
	title: string;
	description?: string | null;
	instructions: string;
	servings?: number;
	prepTime?: number | null;
	cookTime?: number | null;
	cuisineType?: string | null;
	estimatedCalories?: number | null;
	source?: RecipeSource;
	imageUrl?: string | null;
	imageStatus?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
}

export interface UpdateRecipeDao {
	title?: string;
	description?: string | null;
	instructions?: string;
	servings?: number;
	prepTime?: number | null;
	cookTime?: number | null;
	imageUrl?: string | null;
	imageStatus?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
	cuisineType?: string | null;
	estimatedCalories?: number | null;
	isPublic?: boolean;
}

export interface RecipeIngredientDao {
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

export interface NewRecipeIngredientDao {
	recipeId: string;
	name: string;
	quantity: string;
	unit: string;
	unitType: 'WEIGHT' | 'VOLUME' | 'COUNT';
	optional?: boolean;
	notes?: string | null;
	orderIndex: number;
}

export interface RecipeWithIngredientsDao extends RecipeDao {
	ingredients: RecipeIngredientDao[];
}

export interface SavedRecipeDao {
	id: string;
	userId: string;
	recipeId: string;
	createdAt: Date;
	recipe?: RecipeDao;
}

export interface NewSavedRecipeDao {
	userId: string;
	recipeId: string;
}

export interface RecipeImageStatusDao {
	imageStatus: string | null;
	imageUrl: string | null;
}

export interface RecipeCountByReceiptDao {
	receiptId: string;
	count: number;
}

export interface RecipeStepDao {
	id: string;
	recipeId: string;
	position: number;
	verb: TechniqueVerb | null;
	text: string;
	minutes: number | null;
	techniqueKey: string | null;
}

export interface NewRecipeStepDao {
	position: number;
	verb: TechniqueVerb | null;
	text: string;
	minutes: number | null;
}
