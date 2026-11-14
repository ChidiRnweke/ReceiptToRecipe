/**
 * Dishes that taste as good or better the next day: soups, stews, curries, chilli, dals,
 * braises, bakes and grain bowls. Recipes have no tags, so the title decides.
 */
const KEEPS_WELL =
	/\b(soups?|stews?|curr(y|ies)|chil(l)?i|chilli con carne|bowls?|dh?aa?l|casseroles?|tagines?|ragu|ragù|bolognese|chowders?|goulash|braised?|lasagnes?|lasagnas?|korma|tikka masala|biryani|bean bake)\b/i;

/** True when the recipe keeps for a second day, so "Cook for two days" is offered. */
export function keepsWell(recipe: { title: string }): boolean {
	return KEEPS_WELL.test(recipe.title);
}
