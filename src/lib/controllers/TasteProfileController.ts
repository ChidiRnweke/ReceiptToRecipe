import type { ITasteProfileService, DietType, AllergySeverity, PreferenceLevel } from '$services';

export class TasteProfileController {
	constructor(private tasteProfileService: ITasteProfileService) {}

	async getProfile(userId: string) {
		return this.tasteProfileService.getUserTasteProfile(userId);
	}

	async setDietType(userId: string, dietType: DietType | null) {
		return this.tasteProfileService.setDietType(userId, dietType);
	}

	async addAllergy(userId: string, allergen: string, severity: AllergySeverity) {
		return this.tasteProfileService.addAllergy(userId, allergen, severity);
	}

	async removeAllergy(userId: string, allergen: string) {
		return this.tasteProfileService.removeAllergy(userId, allergen);
	}

	async setIngredientPreference(
		userId: string,
		ingredientName: string,
		preference: PreferenceLevel
	) {
		return this.tasteProfileService.setIngredientPreference(userId, ingredientName, preference);
	}

	async removeIngredientPreference(userId: string, ingredientName: string) {
		return this.tasteProfileService.removeIngredientPreference(userId, ingredientName);
	}

	async setCuisinePreference(userId: string, cuisineType: string, preference: PreferenceLevel) {
		return this.tasteProfileService.setCuisinePreference(userId, cuisineType, preference);
	}

	async checkCompatibility(userId: string, recipeId: string) {
		return this.tasteProfileService.checkRecipeCompatibility(userId, recipeId);
	}
}
