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

export interface UpdatePreferencesInput {
	allergies?: string[];
	dietaryRestrictions?: string[];
	cuisinePreferences?: string[];
	excludedIngredients?: string[];
	caloricGoal?: number | null;
	defaultServings?: number;
}

export interface IPreferencesService {
	getPreferences(userId: string): Promise<UserPreferences | null>;
	updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<UserPreferences>;
	addAllergy(userId: string, allergy: string): Promise<UserPreferences>;
	removeAllergy(userId: string, allergy: string): Promise<UserPreferences>;
	addDietaryRestriction(userId: string, restriction: string): Promise<UserPreferences>;
	removeDietaryRestriction(userId: string, restriction: string): Promise<UserPreferences>;
	addExcludedIngredient(userId: string, ingredient: string): Promise<UserPreferences>;
	removeExcludedIngredient(userId: string, ingredient: string): Promise<UserPreferences>;
	setCuisinePreferences(userId: string, cuisines: string[]): Promise<UserPreferences>;
	setCaloricGoal(userId: string, caloricGoal: number | null): Promise<UserPreferences>;
	setDefaultServings(userId: string, servings: number): Promise<UserPreferences>;
}
