import { describe, it, expect } from 'vitest';
import { TOOL_CATALOG, TOOL_INPUTS, type ToolName } from '../../../src/lib/models/agent';

const ID = '6f1c2c1e-0000-4000-8000-000000000001';

/** One valid call of every tool, as the model would make it. */
const EXAMPLES: Record<ToolName, Record<string, unknown>> = {
	whats_for_tonight: {},
	kitchen_stock: {},
	eat_first: {},
	get_plan: {},
	get_shop_list: {},
	why_on_list: { item: 'chicken' },
	find_recipes: { query: 'curry', tab: 'all', tags: ['vegetarian'] },
	find_cookbook_recipes: { query: 'lentil', tags: ['vegetarian'] },
	get_recipe: { recipeId: ID },
	needs_you: {},
	habits: {},
	navigate_to: { door: 'shop' },
	highlight: { key: 'plan-slot:20410:DINNER' },
	suggest_ideas: { tags: ['quick'] },
	use_up_ideas: { itemKey: 'feta' },
	suggest_plan_rest: {},
	eat_out_tonight: {},
	eat_in_tonight: {},
	pick_tonight: { recipeId: ID },
	mark_cooked: { plannedMealId: ID },
	set_plan_slot: { daysFromToday: 3, meal: 'DINNER', recipeId: ID },
	remove_plan_slot: { plannedMealId: ID },
	cook_for_two_days: { plannedMealId: ID },
	fill_plan_rest: {},
	guests_for_meal: { plannedMealId: ID, servings: 4 },
	add_to_list: { items: [{ name: 'Lemons', quantity: 2 }] },
	remove_from_list: { itemId: ID },
	tick_item: { itemId: ID, checked: true },
	mark_gone: { itemKey: 'tomato' },
	still_good: { itemKey: 'tomato' },
	set_amount_left: { itemKey: 'milk', quantity: 500, unit: 'ml' },
	add_to_kitchen: { name: 'Lemons', quantity: 3, category: 'produce' },
	make_recipe_from_craving: { craving: 'something warm with chickpeas' },
	save_recipe: { recipeId: ID },
	unsave_recipe: { recipeId: ID }
};

describe('the tool catalog', () => {
	it('names every tool once', () => {
		const names = TOOL_CATALOG.map((entry) => entry.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it.each(TOOL_CATALOG.map((entry) => entry.name))('parses an example call of %s', (name) => {
		expect(TOOL_INPUTS[name].safeParse(EXAMPLES[name]).success).toBe(true);
	});

	it.each(TOOL_CATALOG.map((entry) => entry.name))(
		'refuses a household id in the arguments of %s',
		(name) => {
			const withHousehold = { ...EXAMPLES[name], householdId: ID };
			expect(TOOL_INPUTS[name].safeParse(withHousehold).success).toBe(false);
		}
	);

	it('refuses an id that is not a uuid', () => {
		expect(TOOL_INPUTS.remove_plan_slot.safeParse({ plannedMealId: '42' }).success).toBe(false);
	});

	it('keeps the plan days inside the ten-day strip', () => {
		const late = { daysFromToday: 10, meal: 'DINNER', recipeId: ID };
		expect(TOOL_INPUTS.set_plan_slot.safeParse(late).success).toBe(false);
	});

	it('asks navigate_to for a door or a recipe, not both', () => {
		expect(TOOL_INPUTS.navigate_to.safeParse({ door: 'plan', recipeId: ID }).success).toBe(false);
	});

	it('marks the browser tools as client tools', () => {
		const client = TOOL_CATALOG.filter((entry) => 'surface' in entry).map((entry) => entry.name);
		expect(client).toEqual(['navigate_to', 'highlight']);
	});

	it('gives every tool a description of more than a few words', () => {
		const short = TOOL_CATALOG.filter((entry) => entry.description.split(' ').length < 8);
		expect(short.map((entry) => entry.name)).toEqual([]);
	});
});
