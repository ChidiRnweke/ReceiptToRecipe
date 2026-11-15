/**
 * The fixed vocabulary of recipe tags. Rules set the diet and effort tags from a recipe's
 * ingredients and steps; the model judges the planning and course tags.
 */
import { z } from 'zod';

export const DIET_TAGS = [
	'vegetarian',
	'vegan',
	'pescatarian',
	'gluten-free',
	'dairy-free'
] as const;
export const EFFORT_TAGS = ['quick', 'one-pot'] as const;
export const PLANNING_TAGS = ['keeps-well', 'freezes', 'lunchbox'] as const;
export const COURSE_TAGS = ['breakfast', 'main', 'side', 'dessert', 'snack'] as const;

export const RECIPE_TAGS = [
	...DIET_TAGS,
	...EFFORT_TAGS,
	...PLANNING_TAGS,
	...COURSE_TAGS
] as const;

export type DietTag = (typeof DIET_TAGS)[number];
export type RecipeTag = (typeof RECIPE_TAGS)[number];

/** The tags the model judges; the rest come from rules. */
export const JUDGED_TAGS = [...PLANNING_TAGS, ...COURSE_TAGS] as const;
export type JudgedTag = (typeof JUDGED_TAGS)[number];

/** The tags the Recipes door offers as filters. */
export const FILTER_TAGS = [
	'vegetarian',
	'vegan',
	'pescatarian',
	'gluten-free',
	'dairy-free',
	'quick',
	'keeps-well',
	'lunchbox',
	'freezes'
] as const satisfies readonly RecipeTag[];

/** A recipe is quick when it takes this many minutes or fewer. */
export const QUICK_MINUTES = 30;

export interface RecipeTagCopy {
	/** The chip text, e.g. "keeps well". */
	label: string;
	/** What the tag means, for the model and for people. */
	meaning: string;
}

export const TAG_COPY: Record<RecipeTag, RecipeTagCopy> = {
	vegetarian: { label: 'vegetarian', meaning: 'No meat or fish.' },
	vegan: { label: 'vegan', meaning: 'No meat, fish, dairy, eggs or honey.' },
	pescatarian: { label: 'pescatarian', meaning: 'Fish or seafood, but no meat.' },
	'gluten-free': { label: 'gluten-free', meaning: 'No wheat, barley, rye or oats.' },
	'dairy-free': { label: 'dairy-free', meaning: 'No milk, butter, cream, cheese or yogurt.' },
	quick: { label: 'quick', meaning: `Ready in ${QUICK_MINUTES} minutes or less.` },
	'one-pot': { label: 'one pot', meaning: 'Cooked in one pot, pan or tray.' },
	'keeps-well': {
		label: 'keeps well',
		meaning: 'Tastes as good or better the next day, so it can be cooked for two days.'
	},
	freezes: { label: 'freezes', meaning: 'Freezes and reheats well.' },
	lunchbox: { label: 'lunchbox', meaning: 'Good cold or reheated in a lunchbox the next day.' },
	breakfast: { label: 'breakfast', meaning: 'A breakfast or brunch dish.' },
	main: { label: 'main', meaning: 'A main course.' },
	side: { label: 'side', meaning: 'A side dish.' },
	dessert: { label: 'dessert', meaning: 'A dessert or sweet bake.' },
	snack: { label: 'snack', meaning: 'A snack or small bite.' }
};

/** Where each stored tag came from. `ai` is null until the model has judged the recipe. */
export interface RecipeTagSource {
	rule: RecipeTag[];
	ai: JudgedTag[] | null;
}

export const recipeTagSchema = z.enum(RECIPE_TAGS);

export function isRecipeTag(value: unknown): value is RecipeTag {
	return typeof value === 'string' && (RECIPE_TAGS as readonly string[]).includes(value);
}

export function isJudgedTag(value: unknown): value is JudgedTag {
	return typeof value === 'string' && (JUDGED_TAGS as readonly string[]).includes(value);
}

/**
 * The judged tags in a model's answer, once each, in vocabulary order. Unknown values and the
 * tags rules own are dropped; a value that is not a list reads as no tags.
 */
export function judgedTagsFrom(values: unknown): JudgedTag[] {
	if (!Array.isArray(values)) return [];
	const wanted = new Set(
		values.map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	);
	return JUDGED_TAGS.filter((tag) => wanted.has(tag));
}

/** Tags of a model's recipe JSON; absent when the model said nothing about tags. */
export const generatedTagsSchema = z
	.unknown()
	.optional()
	.transform((value) =>
		value === undefined || value === null ? undefined : judgedTagsFrom(value)
	);
