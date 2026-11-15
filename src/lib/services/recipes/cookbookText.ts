/**
 * Pure helpers over catalog recipes: the item keys the catalog matches kitchens on, the tags a
 * catalog recipe carries, and its text for embedding.
 */
import {
	isJudgedTag,
	RECIPE_TAGS,
	type CookbookStructure,
	type RecipeTag
} from '$lib/models/recipes';
import { normalizeItemKey } from '../kitchen/itemKey';
import { deriveTags } from './tags';

/** Each ingredient's item key and its last word, e.g. "sliced mushroom" and "mushroom". */
export function itemKeysOf(recipe: Pick<CookbookStructure, 'ingredients'>): string[] {
	const keys = new Set<string>();
	for (const ingredient of recipe.ingredients) {
		const key = normalizeItemKey(ingredient.name);
		if (!key) continue;
		keys.add(key);
		const words = key.split(' ');
		if (words.length > 1) keys.add(words[words.length - 1]);
	}
	return [...keys];
}

/**
 * The catalog recipe's tags: diet, quick and one-pot from the rules, which read every
 * ingredient, and the course and planning tags the structurer judged.
 */
export function cookbookTags(recipe: CookbookStructure): RecipeTag[] {
	const rule = deriveTags(
		{ prepTime: recipe.prepTime, cookTime: recipe.cookTime },
		recipe.ingredients,
		recipe.steps
	);
	const all = new Set<RecipeTag>([...rule, ...recipe.tags.filter(isJudgedTag)]);
	return RECIPE_TAGS.filter((tag) => all.has(tag));
}

/** The text a catalog recipe is embedded from: title, cuisine and ingredients. */
export function embeddingText(recipe: CookbookStructure): string {
	return [
		recipe.title,
		recipe.cuisine ?? '',
		recipe.description,
		`Ingredients: ${recipe.ingredients.map((ingredient) => ingredient.name).join(', ')}`
	]
		.filter(Boolean)
		.join('\n');
}
