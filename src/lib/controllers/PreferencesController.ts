import { db } from '$db/client';
import { userPreferences } from '$db/schema';
import type { UserPreferences, NewUserPreferences } from '$db/schema';
import { eq } from 'drizzle-orm';

export interface UpdatePreferencesInput {
	allergies?: string[];
	dietaryRestrictions?: string[];
	cuisinePreferences?: string[];
	excludedIngredients?: string[];
	caloricGoal?: number | null;
	defaultServings?: number;
}

export class PreferencesController {
	/**
	 * Get user preferences
	 */
	async getPreferences(userId: string): Promise<UserPreferences | null> {
		const prefs = await db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, userId)
		});

		return prefs || null;
	}

	/**
	 * Create or update user preferences
	 */
	async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<UserPreferences> {
		const existing = await this.getPreferences(userId);

		if (existing) {
			const [updated] = await db
				.update(userPreferences)
				.set({
					...input,
					updatedAt: new Date()
				})
				.where(eq(userPreferences.userId, userId))
				.returning();

			return updated;
		} else {
			const [created] = await db
				.insert(userPreferences)
				.values({
					userId,
					...input
				})
				.returning();

			return created;
		}
	}

	/**
	 * Add an allergy
	 */
	async addAllergy(userId: string, allergy: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const allergies = prefs?.allergies || [];

		if (!allergies.includes(allergy)) {
			allergies.push(allergy);
		}

		return this.updatePreferences(userId, { allergies });
	}

	/**
	 * Remove an allergy
	 */
	async removeAllergy(userId: string, allergy: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const allergies = (prefs?.allergies || []).filter((a) => a !== allergy);

		return this.updatePreferences(userId, { allergies });
	}

	/**
	 * Add a dietary restriction
	 */
	async addDietaryRestriction(userId: string, restriction: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const restrictions = prefs?.dietaryRestrictions || [];

		if (!restrictions.includes(restriction)) {
			restrictions.push(restriction);
		}

		return this.updatePreferences(userId, { dietaryRestrictions: restrictions });
	}

	/**
	 * Remove a dietary restriction
	 */
	async removeDietaryRestriction(userId: string, restriction: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const restrictions = (prefs?.dietaryRestrictions || []).filter((r) => r !== restriction);

		return this.updatePreferences(userId, { dietaryRestrictions: restrictions });
	}

	/**
	 * Add an excluded ingredient
	 */
	async addExcludedIngredient(userId: string, ingredient: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const excluded = prefs?.excludedIngredients || [];

		if (!excluded.includes(ingredient)) {
			excluded.push(ingredient);
		}

		return this.updatePreferences(userId, { excludedIngredients: excluded });
	}

	/**
	 * Remove an excluded ingredient
	 */
	async removeExcludedIngredient(userId: string, ingredient: string): Promise<UserPreferences> {
		const prefs = await this.getPreferences(userId);
		const excluded = (prefs?.excludedIngredients || []).filter((e) => e !== ingredient);

		return this.updatePreferences(userId, { excludedIngredients: excluded });
	}

	/**
	 * Set cuisine preferences
	 */
	async setCuisinePreferences(userId: string, cuisines: string[]): Promise<UserPreferences> {
		return this.updatePreferences(userId, { cuisinePreferences: cuisines });
	}

	/**
	 * Set caloric goal
	 */
	async setCaloricGoal(userId: string, caloricGoal: number | null): Promise<UserPreferences> {
		return this.updatePreferences(userId, { caloricGoal });
	}

	/**
	 * Set default servings
	 */
	async setDefaultServings(userId: string, servings: number): Promise<UserPreferences> {
		return this.updatePreferences(userId, { defaultServings: servings });
	}
}
