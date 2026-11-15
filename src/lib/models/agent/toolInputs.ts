/**
 * The arguments each of Basil's tools takes, as strict zod objects.
 *
 * They live with the models, not with the tools, because the browser parses the client tools'
 * arguments with the same schemas. No schema takes a user or household id: the tools act for the
 * signed-in member only.
 */

import { z } from 'zod';
import { BASIL_DOORS } from './doors';
import { recipeTagSchema } from '../recipes/tags';
import { recipeRefSchema } from '../recipes/cookbook';
import type { ToolName } from './toolCatalog';

const none = z.object({}).strict();
const id = z.uuid();
/** A household recipe's id or a shared-cookbook recipe's `cookbook-<uuid>`. */
const recipeId = recipeRefSchema;
const itemKey = z.string().trim().min(1).max(200);
const quantity = z.number().positive().max(100_000);
const unit = z.string().trim().min(1).max(20);
const daysFromToday = z.number().int().min(0).max(9);
const meal = z.enum(['DINNER', 'LUNCH']);
const tags = z.array(recipeTagSchema).min(1).max(5);

export const TOOL_INPUTS = {
	whats_for_tonight: none,
	kitchen_stock: none,
	eat_first: none,
	get_plan: none,
	get_shop_list: none,
	why_on_list: z.object({ item: z.string().trim().min(1).max(120) }).strict(),
	find_recipes: z
		.object({
			query: z.string().trim().min(1).max(120).optional(),
			tab: z.enum(['made', 'saved', 'added', 'all']).optional(),
			tags: tags.optional()
		})
		.strict(),
	find_cookbook_recipes: z
		.object({
			query: z.string().trim().min(1).max(120).optional(),
			tags: tags.optional()
		})
		.strict(),
	get_recipe: z.object({ recipeId }).strict(),
	needs_you: none,
	habits: none,
	navigate_to: z
		.object({ door: z.enum(BASIL_DOORS).optional(), recipeId: recipeId.optional() })
		.strict()
		.refine((input) => (input.door ? 1 : 0) + (input.recipeId ? 1 : 0) === 1, {
			message: 'Pass either a door or a recipeId.'
		}),
	highlight: z
		.object({
			key: z
				.string()
				.trim()
				.min(1)
				.max(120)
				.regex(/^[a-z-]+(:[A-Za-z0-9 _-]+)*$/, 'Use a key such as plan-slot:20410:DINNER.')
		})
		.strict(),

	suggest_ideas: z.object({ tags: tags.optional() }).strict(),
	use_up_ideas: z.object({ itemKey }).strict(),
	suggest_plan_rest: none,

	eat_out_tonight: none,
	eat_in_tonight: none,
	pick_tonight: z.object({ recipeId }).strict(),
	mark_cooked: z
		.object({ plannedMealId: id.optional(), recipeId: recipeId.optional() })
		.strict()
		.refine((input) => (input.plannedMealId ? 1 : 0) + (input.recipeId ? 1 : 0) === 1, {
			message: 'Pass either a plannedMealId or a recipeId.'
		}),
	set_plan_slot: z.object({ daysFromToday, meal, recipeId }).strict(),
	remove_plan_slot: z.object({ plannedMealId: id }).strict(),
	cook_for_two_days: z.object({ plannedMealId: id }).strict(),
	fill_plan_rest: none,
	guests_for_meal: z
		.object({ plannedMealId: id, servings: z.number().int().min(1).max(20) })
		.strict(),
	add_to_list: z
		.object({
			items: z
				.array(
					z
						.object({
							name: z.string().trim().min(1).max(120),
							quantity: quantity.optional(),
							unit: unit.optional()
						})
						.strict()
				)
				.min(1)
				.max(10)
		})
		.strict(),
	remove_from_list: z.object({ itemId: id }).strict(),
	tick_item: z.object({ itemId: id, checked: z.boolean() }).strict(),
	mark_gone: z.object({ itemKey }).strict(),
	still_good: z.object({ itemKey }).strict(),
	set_amount_left: z
		.object({ itemKey, quantity: z.number().min(0).max(100_000), unit: unit.optional() })
		.strict(),
	add_to_kitchen: z
		.object({
			name: z.string().trim().min(1).max(120),
			quantity: quantity.optional(),
			unit: unit.optional(),
			category: z
				.enum([
					'produce',
					'dairy',
					'meat',
					'seafood',
					'bakery',
					'pantry',
					'frozen',
					'canned',
					'other'
				])
				.optional()
		})
		.strict(),
	make_recipe_from_craving: z.object({ craving: z.string().trim().min(1).max(200) }).strict(),
	save_recipe: z.object({ recipeId }).strict(),
	unsave_recipe: z.object({ recipeId: id }).strict()
} as const satisfies Record<ToolName, z.ZodType<Record<string, unknown>>>;

export type ToolInput<N extends ToolName> = z.infer<(typeof TOOL_INPUTS)[N]>;
