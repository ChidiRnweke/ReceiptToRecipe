// Data Access Objects - Decoupled from DB schema
// These are the types returned by repositories and used by services

export interface UserDao {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewUserDao {
	email: string;
	name: string;
	avatarUrl?: string | null;
	passwordHash?: string | null;
	authProvider?: string;
	authProviderId?: string | null;
}

export interface SessionDao {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface NewSessionDao {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface UserPreferencesDao {
	id: string;
	userId: string;
	allergies: string[];
	dietaryRestrictions: string[];
	cuisinePreferences: string[];
	excludedIngredients: string[];
	caloricGoal: number | null;
	defaultServings: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewUserPreferencesDao {
	userId: string;
	allergies?: string[];
	dietaryRestrictions?: string[];
	cuisinePreferences?: string[];
	excludedIngredients?: string[];
	caloricGoal?: number | null;
	defaultServings?: number;
}

export interface UpdateUserPreferencesDao {
	allergies?: string[];
	dietaryRestrictions?: string[];
	cuisinePreferences?: string[];
	excludedIngredients?: string[];
	caloricGoal?: number | null;
	defaultServings?: number;
}
