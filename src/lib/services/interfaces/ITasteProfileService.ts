export interface CompatibilityResult {
  compatible: boolean;
  warnings: string[];
  blockers: string[];
  matchScore: number;
}

export type DietType =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "paleo"
  | "halal"
  | "kosher";
export type PreferenceLevel = "love" | "like" | "neutral" | "dislike" | "avoid";
export type AllergySeverity = "avoid" | "severe";

export interface TasteProfile {
  dietType: DietType | null;
  allergies: { allergen: string; severity: AllergySeverity }[];
  ingredientPreferences: {
    ingredientName: string;
    preference: PreferenceLevel;
  }[];
  cuisinePreferences: { cuisineType: string; preference: PreferenceLevel }[];
}

export interface ITasteProfileService {
  getUserTasteProfile(userId: string): Promise<TasteProfile>;
  setDietType(userId: string, dietType: DietType | null): Promise<void>;
  addAllergy(
    userId: string,
    allergen: string,
    severity: AllergySeverity,
  ): Promise<void>;
  removeAllergy(userId: string, allergen: string): Promise<void>;
  setIngredientPreference(
    userId: string,
    ingredientName: string,
    preference: PreferenceLevel,
  ): Promise<void>;
  removeIngredientPreference(
    userId: string,
    ingredientName: string,
  ): Promise<void>;
  setCuisinePreference(
    userId: string,
    cuisineType: string,
    preference: PreferenceLevel,
  ): Promise<void>;
  checkRecipeCompatibility(
    userId: string,
    recipeId: string,
  ): Promise<CompatibilityResult>;
}
