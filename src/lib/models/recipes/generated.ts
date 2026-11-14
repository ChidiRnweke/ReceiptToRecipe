/**
 * Schemas for the recipe JSON a language model returns. They parse at the provider boundary, so
 * the rest of the app receives a complete recipe. A missing title, unit or quantity gets the same
 * placeholder the app used before ("Untitled Recipe", "count", 1); a wrong shape is an error.
 */
import { z } from 'zod';

const minutes = z
	.number()
	.nonnegative()
	.nullish()
	.transform((value) => (value == null ? null : Math.round(value)));

/** A quantity such as `2`, `"2"` or `"1.5"`; anything else (for example "to taste") counts as 1. */
const quantity = z.union([z.number(), z.string()]).transform((value) => {
	const parsed = typeof value === 'number' ? value : parseFloat(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
});

export const generatedStepSchema = z.object({
	verb: z
		.string()
		.nullish()
		.transform((value) => value ?? null),
	text: z.string().trim().min(1),
	minutes: minutes.optional().transform((value) => value ?? null)
});

export const generatedIngredientSchema = z.object({
	name: z.string().trim().min(1).catch('Unknown'),
	quantity: quantity.default(1),
	unit: z.string().trim().min(1).catch('count'),
	optional: z.boolean().default(false),
	notes: z
		.string()
		.nullish()
		.transform((value) => value || undefined)
});

export const generatedRecipeSchema = z.object({
	title: z.string().trim().min(1).catch('Untitled Recipe'),
	description: z.string().default(''),
	instructions: z.string().default(''),
	steps: z.array(generatedStepSchema).default([]),
	servings: z.number().positive().optional(),
	prepTime: z.number().nonnegative().default(0),
	cookTime: z.number().nonnegative().default(0),
	cuisineType: z
		.string()
		.nullish()
		.transform((value) => value || undefined),
	estimatedCalories: z
		.number()
		.nonnegative()
		.nullish()
		.transform((value) => (value == null ? undefined : Math.round(value))),
	ingredients: z.array(generatedIngredientSchema).default([])
});

export type GeneratedRecipeJson = z.infer<typeof generatedRecipeSchema>;

/** What the model says a snapped photo shows; `none` when it holds no recipe and no dish. */
export const snappedRecipeSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.enum(['page', 'screenshot', 'dish']), recipe: generatedRecipeSchema }),
	z.object({ kind: z.literal('none') })
]);
