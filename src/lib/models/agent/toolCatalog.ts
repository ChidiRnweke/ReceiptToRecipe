/**
 * Every tool Basil can call: its name, what it does to the household's data, and the description
 * the model reads. Kept free of controllers and services, so the browser, tests and scripts can
 * read it without building the application.
 */

export interface ToolCatalogEntry {
	readonly name: string;
	readonly classification: 'read' | 'proposal' | 'mutation';
	/** Written for the model: what the tool does, when to use it, and what it returns. */
	readonly description: string;
	/** `client`: the browser carries the tool out, for example opening a door. */
	readonly surface?: 'client';
}

export const TOOL_CATALOG = [
	// ─── Read ─────────────────────────────────────────────────────────────
	{
		name: 'whats_for_tonight',
		classification: 'read',
		description:
			"What's for dinner tonight (or tomorrow once tonight is over): the planned meal with its plannedMealId, recipeId, what it uses up and what is missing, or a few ideas when nothing is planned. Also says if the household is eating out."
	},
	{
		name: 'kitchen_stock',
		classification: 'read',
		description:
			'Everything the kitchen holds, by name, with amounts and days left. Each item has an itemKey that the kitchen tools take. An amount marked estimate was worked out from cooking.'
	},
	{
		name: 'eat_first',
		classification: 'read',
		description:
			'What needs eating first: perishables and leftovers that have gone off or go off within three days, soonest first, with their itemKey.'
	},
	{
		name: 'get_plan',
		classification: 'read',
		description:
			'The meal plan for the next ten days. Each slot has daysFromToday (0 is today), the weekday, the meal (DINNER or LUNCH), and the planned meal with its plannedMealId, recipeId and servings. Also lists the open slots and how many things still have to be bought.'
	},
	{
		name: 'get_shop_list',
		classification: 'read',
		description:
			'The shopping list for the next shop, grouped by the planned dish each item is for, plus usuals running low and things added by hand. Each item has an itemId and whether it is ticked.'
	},
	{
		name: 'why_on_list',
		classification: 'read',
		description:
			'Why an item is on the shopping list: which planned meals need it and when. Pass the item name as the person said it, e.g. "chicken".'
	},
	{
		name: 'find_recipes',
		classification: 'read',
		description:
			'The household\'s recipes, newest first, with their recipeId and tags. Pass a few words to search titles, a tab: made (cooked before), saved, added (made up or snapped) or all, and tags the recipes must have, e.g. ["vegetarian", "quick"]. Tags: vegetarian, vegan, pescatarian, gluten-free, dairy-free, quick, one-pot, keeps-well, freezes, lunchbox, breakfast, main, side, dessert, snack.'
	},
	{
		name: 'find_cookbook_recipes',
		classification: 'read',
		description:
			'Recipes from the shared Wikibooks Cookbook that the household has not used yet, that suit every member\'s diet and contain none of their allergens. Pass a few words to search titles and ingredients, e.g. "lentil", and tags they must have. Each recipeId starts with cookbook-; get_recipe, set_plan_slot, pick_tonight, mark_cooked and save_recipe take it, and planning, saving or cooking one copies it into the household\'s recipes.'
	},
	{
		name: 'get_recipe',
		classification: 'read',
		description:
			'One recipe of the household by recipeId: title, servings, time, ingredients and steps.'
	},
	{
		name: 'needs_you',
		classification: 'read',
		description:
			'The questions the app has for this person right now (the Needs you list): things going off, meals missing ingredients, open plan days, shop-day offers and what other members did.'
	},
	{
		name: 'habits',
		classification: 'read',
		description:
			"What the app has learned about the household: shop days, prep day, how much they plan, who shops. Use it to answer questions such as 'when do we usually shop?'."
	},
	{
		name: 'navigate_to',
		classification: 'read',
		surface: 'client',
		description:
			"Opens a door on the person's screen (tonight, plan, shop, recipes or use-it-up), or a recipe page when you pass recipeId. Use it when the answer is easier to see than to read."
	},
	{
		name: 'highlight',
		classification: 'read',
		surface: 'client',
		description:
			"Scrolls to one thing on the person's screen and outlines it for a moment. Pass a key from the page context's visibleIds or from a tool result's basilKey, such as tonight-card, plan-slot:20410:DINNER, shop-group:<plannedMealId> or kitchen-item:feta."
	},

	// ─── Proposal ─────────────────────────────────────────────────────────
	{
		name: 'suggest_ideas',
		classification: 'proposal',
		description:
			'Five other recipes the household could cook tonight instead, ranked by what is at home and what goes off soon, and suiting every member’s diet. Pass tags to keep only those recipes, e.g. ["quick"] (the same tags as find_recipes). Changes nothing; offer one, then use pick_tonight if the person wants it.'
	},
	{
		name: 'use_up_ideas',
		classification: 'proposal',
		description:
			'Household recipes that use one kitchen item, by itemKey, ranked by what else they use up. Changes nothing.'
	},
	{
		name: 'suggest_plan_rest',
		classification: 'proposal',
		description:
			'The open plan slots in the next days and ranked recipes that would suit them. Changes nothing; propose set_plan_slot for the ones the person likes, or fill_plan_rest to fill them all.'
	},

	// ─── Mutation: these wait for the person's yes ────────────────────────
	{
		name: 'eat_out_tonight',
		classification: 'mutation',
		description:
			"Marks tonight as eating out. Tonight's planned dinner moves to the next free day before its fresh things go off."
	},
	{
		name: 'eat_in_tonight',
		classification: 'mutation',
		description:
			'Undoes eating out tonight: the household is home for dinner after all, and the dinner goes back on tonight.'
	},
	{
		name: 'pick_tonight',
		classification: 'mutation',
		description:
			"Plans a different household recipe for tonight's dinner, by recipeId. The planned one moves along."
	},
	{
		name: 'mark_cooked',
		classification: 'mutation',
		description:
			'Records that the household cooked and ate a meal: pass the plannedMealId of a planned meal, or a recipeId for something unplanned. The kitchen uses up its ingredients.'
	},
	{
		name: 'set_plan_slot',
		classification: 'mutation',
		description:
			'Puts a household recipe on a day of the plan: daysFromToday (0 is today, up to 9), meal DINNER or LUNCH, and recipeId. Replaces what is planned in that slot.'
	},
	{
		name: 'remove_plan_slot',
		classification: 'mutation',
		description: 'Takes a planned meal, and its leftovers, off the plan by plannedMealId.'
	},
	{
		name: 'cook_for_two_days',
		classification: 'mutation',
		description:
			"Toggles cooking a planned dinner for two days, by plannedMealId: one extra portion that becomes the next day's lunch. Calling it again goes back to just that night."
	},
	{
		name: 'fill_plan_rest',
		classification: 'mutation',
		description:
			'Fills every open slot in the next days with ranked recipes that suit everyone in the household.'
	},
	{
		name: 'guests_for_meal',
		classification: 'mutation',
		description:
			'Sets how many people one planned meal is for, by plannedMealId and servings (1 to 20). Use it for "friends over Friday": the extra goes on the list.'
	},
	{
		name: 'add_to_list',
		classification: 'mutation',
		description:
			'Adds things to the shopping list by hand: up to ten items, each a name with an optional quantity and unit.'
	},
	{
		name: 'remove_from_list',
		classification: 'mutation',
		description:
			'Takes an item that was added by hand off the shopping list, by itemId. Items the plan put there go when the plan changes.'
	},
	{
		name: 'tick_item',
		classification: 'mutation',
		description: 'Ticks an item on the shopping list as got, or unticks it, by itemId.'
	},
	{
		name: 'mark_gone',
		classification: 'mutation',
		description: 'Records that a kitchen item is gone or was binned, by itemKey.'
	},
	{
		name: 'still_good',
		classification: 'mutation',
		description:
			'Records that a kitchen item the app thought had gone off is still good, by itemKey.'
	},
	{
		name: 'set_amount_left',
		classification: 'mutation',
		description:
			'Sets how much of a kitchen item is left, by itemKey, quantity and optional unit. Zero means none left.'
	},
	{
		name: 'add_to_kitchen',
		classification: 'mutation',
		description:
			'Records something the household has at home that no receipt or list brought in: a name, an optional quantity and unit, and an optional category (produce, dairy, meat, seafood, bakery, pantry, frozen, canned, other).'
	},
	{
		name: 'make_recipe_from_craving',
		classification: 'mutation',
		description:
			'Makes up a new recipe for a craving, such as "something warm with chickpeas", using what is at home, and adds it to the household\'s recipes.'
	},
	{
		name: 'save_recipe',
		classification: 'mutation',
		description: "Saves a recipe to this person's saved recipes, by recipeId."
	},
	{
		name: 'unsave_recipe',
		classification: 'mutation',
		description: "Takes a recipe out of this person's saved recipes, by recipeId."
	}
] as const satisfies readonly ToolCatalogEntry[];

export type ToolName = (typeof TOOL_CATALOG)[number]['name'];

/** Tools the browser carries out. */
export type ClientToolName = Extract<(typeof TOOL_CATALOG)[number], { surface: 'client' }>['name'];

/** Tools the server carries out. */
export type ServerToolName = Exclude<ToolName, ClientToolName>;

/** The catalog entry of one tool. */
export function toolEntry(name: ToolName): ToolCatalogEntry & { readonly name: ToolName } {
	const entry = TOOL_CATALOG.find((candidate) => candidate.name === name);
	if (!entry) throw new Error(`Tool missing from the catalog: ${name}`);
	return entry;
}
