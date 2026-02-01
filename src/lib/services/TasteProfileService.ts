import { db } from '$db/client';
import { 
    userDietaryProfiles, 
    userAllergies, 
    userIngredientPreferences, 
    userCuisinePreferences,
    recipes,
    recipeIngredients
} from '$db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'halal' | 'kosher';
export type PreferenceLevel = 'love' | 'like' | 'neutral' | 'dislike' | 'avoid';
export type AllergySeverity = 'avoid' | 'severe';

export interface TasteProfile {
    dietType: DietType | null;
    allergies: { allergen: string; severity: AllergySeverity }[];
    ingredientPreferences: { ingredientName: string; preference: PreferenceLevel }[];
    cuisinePreferences: { cuisineType: string; preference: PreferenceLevel }[];
}

export interface CompatibilityResult {
    compatible: boolean;
    warnings: string[];
    blockers: string[];
    matchScore: number;
}

export class TasteProfileService {
    
    async getUserTasteProfile(userId: string): Promise<TasteProfile> {
        const dietProfile = await db.query.userDietaryProfiles.findFirst({
            where: eq(userDietaryProfiles.userId, userId)
        });

        const allergies = await db.query.userAllergies.findMany({
            where: eq(userAllergies.userId, userId)
        });

        const ingredientPrefs = await db.query.userIngredientPreferences.findMany({
            where: eq(userIngredientPreferences.userId, userId)
        });

        const cuisinePrefs = await db.query.userCuisinePreferences.findMany({
            where: eq(userCuisinePreferences.userId, userId)
        });

        return {
            dietType: (dietProfile?.dietType as DietType) || null,
            allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity as AllergySeverity })),
            ingredientPreferences: ingredientPrefs.map(p => ({ ingredientName: p.ingredientName, preference: p.preference as PreferenceLevel })),
            cuisinePreferences: cuisinePrefs.map(c => ({ cuisineType: c.cuisineType, preference: c.preference as PreferenceLevel }))
        };
    }

    async setDietType(userId: string, dietType: DietType | null): Promise<void> {
        if (dietType === null) {
            await db.delete(userDietaryProfiles).where(eq(userDietaryProfiles.userId, userId));
            return;
        }

        await db.insert(userDietaryProfiles)
            .values({ userId, dietType })
            .onConflictDoUpdate({
                target: userDietaryProfiles.userId,
                set: { dietType, updatedAt: new Date() }
            });
    }

    async addAllergy(userId: string, allergen: string, severity: AllergySeverity): Promise<void> {
        await db.insert(userAllergies)
            .values({ userId, allergen, severity })
            .onConflictDoUpdate({
                target: [userAllergies.userId, userAllergies.allergen],
                set: { severity }
            });
    }

    async removeAllergy(userId: string, allergen: string): Promise<void> {
        await db.delete(userAllergies)
            .where(and(eq(userAllergies.userId, userId), eq(userAllergies.allergen, allergen)));
    }

    async setIngredientPreference(userId: string, ingredientName: string, preference: PreferenceLevel): Promise<void> {
        await db.insert(userIngredientPreferences)
            .values({ userId, ingredientName, preference })
            .onConflictDoUpdate({
                target: [userIngredientPreferences.userId, userIngredientPreferences.ingredientName],
                set: { preference }
            });
    }

    async removeIngredientPreference(userId: string, ingredientName: string): Promise<void> {
        await db.delete(userIngredientPreferences)
            .where(and(
                eq(userIngredientPreferences.userId, userId), 
                eq(userIngredientPreferences.ingredientName, ingredientName)
            ));
    }

    async setCuisinePreference(userId: string, cuisineType: string, preference: PreferenceLevel): Promise<void> {
        await db.insert(userCuisinePreferences)
            .values({ userId, cuisineType, preference })
            .onConflictDoUpdate({
                target: [userCuisinePreferences.userId, userCuisinePreferences.cuisineType],
                set: { preference }
            });
    }

    async checkRecipeCompatibility(userId: string, recipeId: string): Promise<CompatibilityResult> {
        const profile = await this.getUserTasteProfile(userId);
        const recipe = await db.query.recipes.findFirst({
            where: eq(recipes.id, recipeId),
            with: { ingredients: true }
        });

        if (!recipe) throw new Error("Recipe not found");

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
            const pref = profile.ingredientPreferences.find(p => 
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
            const pref = profile.cuisinePreferences.find(c => 
                c.cuisineType.toLowerCase() === recipe.cuisineType?.toLowerCase()
            );
            if (pref) {
                if (pref.preference === 'love') matchScore += 20;
                if (pref.preference === 'dislike') matchScore -= 20;
            }
        }

        // Check Diet Type (simplified check)
        // In a real app, we'd need deeper analysis or tags on the recipe.
        // For now, we rely on recipe tags if they existed, or LLM generation to respect it.
        // We can check rudimentary things like "chicken" in a vegan diet.
        if (profile.dietType === 'vegan' || profile.dietType === 'vegetarian') {
            const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'steak', 'meat'];
            const fishKeywords = ['fish', 'salmon', 'tuna', 'shrimp', 'crab'];
            const forbidden = profile.dietType === 'vegan' ? [...meatKeywords, ...fishKeywords, 'egg', 'cheese', 'milk', 'honey'] : [...meatKeywords, ...fishKeywords];
            
            for (const ing of recipe.ingredients) {
                if (forbidden.some(k => ing.name.toLowerCase().includes(k))) {
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

    private recipeContains(recipe: any, term: string): boolean {
        const normalizedTerm = term.toLowerCase();
        // Check ingredients
        if (recipe.ingredients.some((i: any) => i.name.toLowerCase().includes(normalizedTerm))) return true;
        // Check title
        if (recipe.title.toLowerCase().includes(normalizedTerm)) return true;
        return false;
    }
}
