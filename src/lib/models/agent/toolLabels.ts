import type { ToolName } from './toolCatalog';

/** What the sheet shows while a tool runs, in the shop-window voice of the doors. */
export const TOOL_LABEL = {
	whats_for_tonight: 'Looking at tonight…',
	kitchen_stock: 'Checking the kitchen…',
	eat_first: 'Seeing what needs eating first…',
	get_plan: 'Looking at your plan…',
	get_shop_list: 'Reading the shopping list…',
	why_on_list: 'Working out why that’s on the list…',
	find_recipes: 'Looking through your recipes…',
	find_cookbook_recipes: 'Looking through the cookbook…',
	get_recipe: 'Opening the recipe…',
	needs_you: 'Checking what needs you…',
	habits: 'Remembering how you shop and plan…',
	navigate_to: 'Opening the door…',
	highlight: 'Finding it on the page…',
	suggest_ideas: 'Thinking of ideas…',
	use_up_ideas: 'Thinking of ways to use it up…',
	suggest_plan_rest: 'Thinking about the rest of the week…',
	eat_out_tonight: 'Getting that change ready…',
	eat_in_tonight: 'Getting that change ready…',
	pick_tonight: 'Getting that change ready…',
	mark_cooked: 'Getting that change ready…',
	set_plan_slot: 'Getting that change ready…',
	remove_plan_slot: 'Getting that change ready…',
	cook_for_two_days: 'Getting that change ready…',
	fill_plan_rest: 'Getting that change ready…',
	guests_for_meal: 'Getting that change ready…',
	add_to_list: 'Getting that change ready…',
	remove_from_list: 'Getting that change ready…',
	tick_item: 'Getting that change ready…',
	mark_gone: 'Getting that change ready…',
	still_good: 'Getting that change ready…',
	set_amount_left: 'Getting that change ready…',
	add_to_kitchen: 'Getting that change ready…',
	make_recipe_from_craving: 'Getting that change ready…',
	save_recipe: 'Getting that change ready…',
	unsave_recipe: 'Getting that change ready…'
} as const satisfies Record<ToolName, string>;

/** The label for a tool the model named, which may not exist. */
export function toolLabel(name: string): string {
	return (TOOL_LABEL as Record<string, string>)[name] ?? 'Working on it…';
}
