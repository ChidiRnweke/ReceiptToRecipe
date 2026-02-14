import type {
	ITasteProfileService,
	TasteProfile,
	DietType,
	PreferenceLevel,
	AllergySeverity,
	CompatibilityResult
} from '../../src/lib/services/interfaces/ITasteProfileService';

/**
 * Mock implementation of ITasteProfileService for testing
 */
export class MockTasteProfileService implements ITasteProfileService {
	private profiles = new Map<string, TasteProfile>();
	private compatibilities = new Map<string, CompatibilityResult>();

	private getDefaultProfile(): TasteProfile {
		return {
			dietType: null,
			allergies: [],
			ingredientPreferences: [],
			cuisinePreferences: []
		};
	}

	async getUserTasteProfile(userId: string): Promise<TasteProfile> {
		return this.profiles.get(userId) || this.getDefaultProfile();
	}

	async setDietType(userId: string, dietType: DietType | null): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		profile.dietType = dietType;
		this.profiles.set(userId, profile);
	}

	async addAllergy(userId: string, allergen: string, severity: AllergySeverity): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		// Remove existing allergy for this allergen if present
		profile.allergies = profile.allergies.filter((a) => a.allergen !== allergen);
		profile.allergies.push({ allergen, severity });
		this.profiles.set(userId, profile);
	}

	async removeAllergy(userId: string, allergen: string): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		profile.allergies = profile.allergies.filter((a) => a.allergen !== allergen);
		this.profiles.set(userId, profile);
	}

	async setIngredientPreference(
		userId: string,
		ingredientName: string,
		preference: PreferenceLevel
	): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		// Remove existing preference for this ingredient if present
		profile.ingredientPreferences = profile.ingredientPreferences.filter(
			(p) => p.ingredientName !== ingredientName
		);
		profile.ingredientPreferences.push({ ingredientName, preference });
		this.profiles.set(userId, profile);
	}

	async removeIngredientPreference(userId: string, ingredientName: string): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		profile.ingredientPreferences = profile.ingredientPreferences.filter(
			(p) => p.ingredientName !== ingredientName
		);
		this.profiles.set(userId, profile);
	}

	async setCuisinePreference(
		userId: string,
		cuisineType: string,
		preference: PreferenceLevel
	): Promise<void> {
		const profile = await this.getUserTasteProfile(userId);
		// Remove existing preference for this cuisine if present
		profile.cuisinePreferences = profile.cuisinePreferences.filter(
			(c) => c.cuisineType !== cuisineType
		);
		profile.cuisinePreferences.push({ cuisineType, preference });
		this.profiles.set(userId, profile);
	}

	async checkRecipeCompatibility(userId: string, recipeId: string): Promise<CompatibilityResult> {
		const key = `${userId}:${recipeId}`;
		return (
			this.compatibilities.get(key) || {
				compatible: true,
				warnings: [],
				blockers: [],
				matchScore: 100
			}
		);
	}

	// Test helpers
	setProfile(userId: string, profile: TasteProfile): void {
		this.profiles.set(userId, profile);
	}

	setCompatibility(userId: string, recipeId: string, result: CompatibilityResult): void {
		this.compatibilities.set(`${userId}:${recipeId}`, result);
	}

	clear(): void {
		this.profiles.clear();
		this.compatibilities.clear();
	}
}
