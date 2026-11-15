import type { RecipeTag, RecipeTagSource } from '$lib/models/recipes';

/**
 * Dishes that taste as good or better the next day: soups, stews, curries, chilli, dals,
 * braises, bakes and grain bowls. Only recipes the model has not tagged yet are judged by title.
 */
const KEEPS_WELL =
	/\b(soups?|stews?|curr(y|ies)|chil(l)?i|chilli con carne|bowls?|dh?aa?l|casseroles?|tagines?|ragu|ragù|bolognese|chowders?|goulash|braised?|lasagnes?|lasagnas?|korma|tikka masala|biryani|bean bake)\b/i;

/**
 * True when the recipe keeps for a second day, so "Cook for two days" is offered. Once the
 * model has judged the recipe its `keeps-well` tag decides; before that, the title does.
 */
export function keepsWell(recipe: {
	title: string;
	tags?: readonly RecipeTag[] | null;
	tagSource?: RecipeTagSource | null;
}): boolean {
	if (recipe.tags && recipe.tagSource?.ai) return recipe.tags.includes('keeps-well');
	return KEEPS_WELL.test(recipe.title);
}
