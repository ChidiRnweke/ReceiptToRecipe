export type DietTypeDao = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'halal' | 'kosher';
export type PreferenceLevelDao = 'love' | 'like' | 'neutral' | 'dislike' | 'avoid';
export type AllergySeverityDao = 'avoid' | 'severe';

export interface UserDietaryProfileDao {
	id: string;
	userId: string;
	dietType: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewUserDietaryProfileDao {
	userId: string;
	dietType?: string | null;
}

export interface UpdateUserDietaryProfileDao {
	dietType?: string | null;
}

export interface UserAllergyDao {
	id: string;
	userId: string;
	allergen: string;
	severity: string;
	createdAt: Date;
}

export interface NewUserAllergyDao {
	userId: string;
	allergen: string;
	severity?: string;
}

export interface UserIngredientPreferenceDao {
	id: string;
	userId: string;
	ingredientName: string;
	preference: string;
	createdAt: Date;
}

export interface NewUserIngredientPreferenceDao {
	userId: string;
	ingredientName: string;
	preference: string;
}

export interface UserCuisinePreferenceDao {
	id: string;
	userId: string;
	cuisineType: string;
	preference: string;
	createdAt: Date;
}

export interface NewUserCuisinePreferenceDao {
	userId: string;
	cuisineType: string;
	preference: string;
}

export interface TasteProfileDao {
	dietType: DietTypeDao | null;
	allergies: { allergen: string; severity: AllergySeverityDao }[];
	ingredientPreferences: { ingredientName: string; preference: PreferenceLevelDao }[];
	cuisinePreferences: { cuisineType: string; preference: PreferenceLevelDao }[];
}
