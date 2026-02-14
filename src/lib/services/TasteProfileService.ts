import type {
	IUserDietaryProfileRepository,
	IUserAllergyRepository,
	IUserIngredientPreferenceRepository,
	IUserCuisinePreferenceRepository,
	IRecipeRepository,
	IRecipeIngredientRepository,
	RecipeWithIngredientsDao,
	RecipeIngredientDao
} from '$repositories';
import type {
	ITasteProfileService,
	CompatibilityResult,
	TasteProfile,
	DietType,
	PreferenceLevel,
	AllergySeverity
} from './interfaces/ITasteProfileService';

export {
	type DietType,
	type PreferenceLevel,
	type AllergySeverity,
	type TasteProfile,
	type CompatibilityResult
};

export class TasteProfileService implements ITasteProfileService {
	constructor(
		private dietaryProfileRepo: IUserDietaryProfileRepository,
		private allergyRepo: IUserAllergyRepository,
		private ingredientPrefRepo: IUserIngredientPreferenceRepository,
		private cuisinePrefRepo: IUserCuisinePreferenceRepository,
		private recipeRepo: IRecipeRepository,
		private recipeIngredientRepo: IRecipeIngredientRepository
	) {}

	async getUserTasteProfile(userId: string): Promise<TasteProfile> {
		const dietProfile = await this.dietaryProfileRepo.findByUserId(userId);
		const allergies = await this.allergyRepo.findByUserId(userId);
		const ingredientPrefs = await this.ingredientPrefRepo.findByUserId(userId);
		const cuisinePrefs = await this.cuisinePrefRepo.findByUserId(userId);

		return {
			dietType: (dietProfile?.dietType as DietType) || null,
			allergies: allergies.map((a) => ({
				allergen: a.allergen,
				severity: a.severity as AllergySeverity
			})),
			ingredientPreferences: ingredientPrefs.map((p) => ({
				ingredientName: p.ingredientName,
				preference: p.preference as PreferenceLevel
			})),
			cuisinePreferences: cuisinePrefs.map((c) => ({
				cuisineType: c.cuisineType,
				preference: c.preference as PreferenceLevel
			}))
		};
	}

	async setDietType(userId: string, dietType: DietType | null): Promise<void> {
		if (dietType === null) {
			await this.dietaryProfileRepo.delete(userId);
			return;
		}

		const existing = await this.dietaryProfileRepo.findByUserId(userId);
		if (existing) {
			await this.dietaryProfileRepo.update(userId, { dietType });
		} else {
			await this.dietaryProfileRepo.create({ userId, dietType });
		}
	}

	async addAllergy(userId: string, allergen: string, severity: AllergySeverity): Promise<void> {
		await this.allergyRepo.create({ userId, allergen, severity });
	}

	async removeAllergy(userId: string, allergen: string): Promise<void> {
		await this.allergyRepo.delete(userId, allergen);
	}

	async setIngredientPreference(
		userId: string,
		ingredientName: string,
		preference: PreferenceLevel
	): Promise<void> {
		await this.ingredientPrefRepo.create({
			userId,
			ingredientName,
			preference
		});
	}

	async removeIngredientPreference(userId: string, ingredientName: string): Promise<void> {
		await this.ingredientPrefRepo.delete(userId, ingredientName);
	}

	async setCuisinePreference(
		userId: string,
		cuisineType: string,
		preference: PreferenceLevel
	): Promise<void> {
		await this.cuisinePrefRepo.create({ userId, cuisineType, preference });
	}

	async checkRecipeCompatibility(userId: string, recipeId: string): Promise<CompatibilityResult> {
		const profile = await this.getUserTasteProfile(userId);
		const recipe = await this.recipeRepo.findByIdWithIngredients(recipeId);

		if (!recipe) throw new Error('Recipe not found');

		const warnings: string[] = [];
		const blockers: string[] = [];
		let matchScore = 100;

		// Check Allergies
		for (const allergy of profile.allergies) {
			if (this.recipeContains(recipe, allergy.allergen)) {
				const msg = `Contains ${allergy.allergen}`;
				if (allergy.severity === 'severe') {
					blockers.push(msg);
					matchScore = 0;
				} else {
					warnings.push(msg);
					matchScore -= 50;
				}
			}
		}

		// Check Ingredient Preferences
		for (const ing of recipe.ingredients) {
			const pref = profile.ingredientPreferences.find((p) =>
				ing.name.toLowerCase().includes(p.ingredientName.toLowerCase())
			);

			if (pref) {
				if (pref.preference === 'avoid' || pref.preference === 'dislike') {
					warnings.push(`Contains ${ing.name} (${pref.preference})`);
					matchScore -= 20;
				} else if (pref.preference === 'love') {
					matchScore += 10;
				}
			}
		}

		// Check Cuisine
		if (recipe.cuisineType) {
			const pref = profile.cuisinePreferences.find(
				(c) => c.cuisineType.toLowerCase() === recipe.cuisineType?.toLowerCase()
			);
			if (pref) {
				if (pref.preference === 'love') matchScore += 20;
				if (pref.preference === 'dislike') matchScore -= 20;
			}
		}

		// Check Diet Type (simplified check)
		if (profile.dietType === 'vegan' || profile.dietType === 'vegetarian') {
			const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'steak', 'meat'];
			const fishKeywords = ['fish', 'salmon', 'tuna', 'shrimp', 'crab'];
			const forbidden =
				profile.dietType === 'vegan'
					? [...meatKeywords, ...fishKeywords, 'egg', 'cheese', 'milk', 'honey']
					: [...meatKeywords, ...fishKeywords];

			for (const ing of recipe.ingredients) {
				if (forbidden.some((k) => ing.name.toLowerCase().includes(k))) {
					warnings.push(`May not be ${profile.dietType} (contains ${ing.name})`);
					matchScore -= 30;
				}
			}
		}

		return {
			compatible: blockers.length === 0,
			warnings,
			blockers,
			matchScore: Math.min(100, Math.max(0, matchScore))
		};
	}

	private recipeContains(recipe: RecipeWithIngredientsDao, term: string): boolean {
		const normalizedTerm = term.toLowerCase();
		// Check ingredients
		if (
			recipe.ingredients.some((i: RecipeIngredientDao) =>
				i.name.toLowerCase().includes(normalizedTerm)
			)
		)
			return true;
		// Check title
		if (recipe.title.toLowerCase().includes(normalizedTerm)) return true;
		return false;
	}
}
