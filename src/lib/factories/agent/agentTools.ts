/**
 * Basil's tools, built over the controllers for one member at one moment.
 *
 * This is the agent's protocol adapter: each tool parses its arguments with its schema from the
 * models, calls the controller methods `agentToolCoverage` binds with the member bound in, and
 * hands back a compact result. No schema takes a user or household id, so a tool can only act
 * for the member who asked. The builders are a keyed object, so the set of tools is a type and
 * two checks hold it equal to the catalog.
 */

import { z } from 'zod';
import type { Actor } from '$lib/models/household';
import {
	TOOL_INPUTS,
	toolEntry,
	type BasilDoor,
	type ClientAction,
	type ToolInput,
	type ToolName,
	type Touched,
	basilKey
} from '$lib/models/agent';
import {
	failureFromError,
	toolFailure,
	type AgentTool,
	type AgentToolbox,
	type ToolParameters
} from '$lib/services/agent/toolbox';
import {
	eatFirstResult,
	habitsResult,
	homeItemResult,
	ideaResult,
	needsYouResult,
	planResult,
	recipesResult,
	cookbookResult,
	shopResult,
	tonightResult,
	whyOnListResult
} from '$lib/services/agent/views';
import { dayNumber } from '$lib/services/kitchen';
import { WEEKDAY_NAMES } from '$lib/services/tonight';
import type { BoundMethod, CoveredAgentControllers } from './agentToolCoverage';

type ToolControllerKey =
	| 'kitchen'
	| 'needsYou'
	| 'plan'
	| 'recipe'
	| 'recipesDoor'
	| 'shop'
	| 'tonight'
	| 'useItUp';

/**
 * The controllers the tools use, narrowed to the methods that bind a tool. A tool cannot call a
 * method the coverage map excluded. Each is a getter, so building the tools builds nothing.
 */
export type AgentToolControllers = {
	readonly [C in ToolControllerKey]: () => Pick<CoveredAgentControllers[C], BoundMethod<C>>;
};

/** Who the tools act for, and when. */
export interface ToolScope {
	actor: Actor;
	now: Date;
	timeZone: string;
}

interface ToolBody<N extends ToolName> {
	/** Doors whose data the change makes stale. */
	doors?: readonly BasilDoor[];
	/** The change in plain words; required for a mutation. Throws when it cannot happen. */
	preview?: (input: ToolInput<N>) => Promise<string>;
	run: (input: ToolInput<N>) => Promise<{
		result: unknown;
		touched?: Touched[];
		clientAction?: ClientAction;
	}>;
}

const BAD_ARGUMENTS =
	'Fix the arguments to match the tool’s schema and call it again. Ids come from the read tools’ results.';

/**
 * The object schema the model is shown, read off zod's JSON schema: the properties and the
 * required ones, and no other fields. Every tool input is a strict zod object.
 */
function toolParameters(schema: z.core.JSONSchema.BaseSchema): ToolParameters {
	if (schema.type !== 'object' || schema.additionalProperties !== false) {
		throw new Error('A tool input must be a strict object');
	}
	const properties: ToolParameters['properties'] = {};
	for (const [key, value] of Object.entries(schema.properties ?? {})) {
		if (typeof value === 'object') properties[key] = { ...value };
	}
	return {
		type: 'object',
		properties,
		required: schema.required ?? [],
		additionalProperties: false
	};
}

/** Builds one tool from its catalog entry, its schema and its body. */
function defineTool<N extends ToolName>(name: N, body: ToolBody<N>): AgentTool<N> {
	const entry = toolEntry(name);
	// Indexing the schema table by a generic name loses the link to `ToolInput<N>`, which is the
	// same table's inferred type, so the parsed value is restated as it.
	const schema: z.ZodType = TOOL_INPUTS[name];
	if (entry.classification === 'mutation' && !body.preview) {
		throw new Error(`The change tool ${name} needs a preview`);
	}
	const parameters = toolParameters(z.toJSONSchema(TOOL_INPUTS[name], { io: 'input' }));
	const parse = (args: unknown) => {
		const parsed = schema.safeParse(args ?? {});
		return parsed.success
			? ({ ok: true, input: parsed.data as ToolInput<N> } as const)
			: ({
					ok: false,
					failure: toolFailure(
						parsed.error.issues.map((issue) => issue.message).join('; '),
						BAD_ARGUMENTS
					)
				} as const);
	};
	return {
		name,
		classification: entry.classification,
		...(entry.surface ? { surface: entry.surface } : {}),
		description: entry.description,
		parameters,
		doors: body.doors ?? [],
		async preview(args) {
			const parsed = parse(args);
			if (!parsed.ok) return parsed;
			try {
				return {
					ok: true,
					value: body.preview ? await body.preview(parsed.input) : entry.description
				};
			} catch (error) {
				return { ok: false, failure: failureFromError(error) };
			}
		},
		async execute(args) {
			const parsed = parse(args);
			if (!parsed.ok) return parsed;
			try {
				const run = await body.run(parsed.input);
				return {
					ok: true,
					value: {
						result: run.result,
						touched: run.touched ?? [],
						...(run.clientAction ? { clientAction: run.clientAction } : {})
					}
				};
			} catch (error) {
				return { ok: false, failure: failureFromError(error) };
			}
		}
	};
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** "today", "tomorrow" or the weekday, for a day number. */
function dayLabel(day: number, today: number): string {
	if (day === today) return 'today';
	if (day === today + 1) return 'tomorrow';
	return WEEKDAY_NAMES[((((day + 3) % 7) + 7) % 7) as 0];
}

const possessive = (label: string) => `${label}’s`;

/** Every tool, keyed by name. */
export function agentToolBuilders(controllers: AgentToolControllers, scope: ToolScope) {
	const { actor, now, timeZone } = scope;
	const today = dayNumber(now, timeZone);
	const c = controllers;

	/** A household recipe; another household's recipe is "not found" even when it is public. */
	async function ownRecipe(recipeId: string) {
		const recipe = await c.recipe().getRecipe(recipeId, actor);
		if (!recipe || recipe.householdId !== actor.householdId) throw new Error('Recipe not found');
		return recipe;
	}

	/** A recipe the member can see: their household's, or a public one. */
	async function visibleRecipe(recipeId: string) {
		const recipe = await c.recipe().getRecipe(recipeId, actor);
		if (!recipe) throw new Error('Recipe not found');
		return recipe;
	}

	/** A planned meal of the household in the next ten days, with its slot. */
	async function plannedSlot(plannedMealId: string) {
		const view = await c.plan().getPlan(actor, now, timeZone);
		const slot = view.slots.find((candidate) => candidate.meal?.plannedMealId === plannedMealId);
		if (!slot?.meal) throw new Error('Planned meal not found in the next ten days');
		return { slot, meal: slot.meal };
	}

	const slotTouched = (day: number, mealType: string, label: string): Touched => ({
		kind: 'planned-meal',
		id: `${day}:${mealType}`,
		label,
		door: 'plan',
		key: basilKey.planSlot(day, mealType)
	});

	async function listItem(itemId: string) {
		const view = await c.shop().getShop(actor, now, timeZone);
		for (const group of view.groups) {
			const item = group.items.find((candidate) => candidate.id === itemId);
			if (item) return { item, key: basilKey.shopGroup(group.mealId), manual: false };
		}
		const usual = view.usuals.find((candidate) => candidate.id === itemId);
		if (usual) return { item: usual, key: basilKey.shopUsuals(), manual: false };
		const manual = view.manual.find((candidate) => candidate.id === itemId);
		if (manual) return { item: manual, key: basilKey.shopManual(), manual: true };
		throw new Error('List item not found');
	}

	async function kitchenItem(itemKey: string) {
		const home = await c.useItUp().listHome(actor, now, timeZone);
		const item = home.find((candidate) => candidate.itemKey === itemKey);
		if (!item) throw new Error('Kitchen item not found');
		return item;
	}

	const kitchenTouched = (itemKey: string, label: string): Touched => ({
		kind: 'kitchen-item',
		id: itemKey,
		label,
		door: 'use-it-up',
		key: basilKey.kitchenItem(itemKey)
	});

	const tonightTouched = (label: string): Touched => ({
		kind: 'tonight',
		id: 'tonight',
		label,
		door: 'tonight',
		key: basilKey.tonightCard()
	});

	const KITCHEN_DOORS = ['use-it-up', 'tonight', 'shop'] as const;
	const PLAN_DOORS = ['plan', 'tonight', 'shop'] as const;

	return {
		// ─── Read ───────────────────────────────────────────────────────
		whats_for_tonight: defineTool('whats_for_tonight', {
			run: async () => ({
				result: tonightResult(await c.tonight().getTonight(actor, now, timeZone))
			})
		}),
		kitchen_stock: defineTool('kitchen_stock', {
			run: async () => ({
				result: {
					items: (await c.useItUp().listHome(actor, now, timeZone)).map(homeItemResult)
				}
			})
		}),
		eat_first: defineTool('eat_first', {
			run: async () => ({ result: eatFirstResult(await c.useItUp().get(actor, now, timeZone)) })
		}),
		get_plan: defineTool('get_plan', {
			run: async () => ({ result: planResult(await c.plan().getPlan(actor, now, timeZone)) })
		}),
		get_shop_list: defineTool('get_shop_list', {
			run: async () => ({ result: shopResult(await c.shop().getShop(actor, now, timeZone)) })
		}),
		why_on_list: defineTool('why_on_list', {
			run: async ({ item }) => ({
				result: whyOnListResult(await c.shop().getShop(actor, now, timeZone), item)
			})
		}),
		find_recipes: defineTool('find_recipes', {
			run: async ({ query, tab, tags }) => ({
				result: recipesResult(
					await c.recipesDoor().listMine(actor, tab ?? 'all', tags ?? []),
					query
				)
			})
		}),
		find_cookbook_recipes: defineTool('find_cookbook_recipes', {
			run: async ({ query, tags }) => ({
				result: cookbookResult(
					await c.recipesDoor().findInCookbook(actor, query ?? null, tags ?? [])
				)
			})
		}),
		get_recipe: defineTool('get_recipe', {
			run: async ({ recipeId }) => {
				const recipe = await visibleRecipe(recipeId);
				return {
					result: {
						recipeId: recipe.id,
						title: recipe.title,
						servings: recipe.servings,
						minutes:
							recipe.prepTime === null && recipe.cookTime === null
								? null
								: (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0),
						calories: recipe.estimatedCalories,
						ingredients: recipe.ingredients.map((ingredient) => ({
							name: ingredient.name,
							quantity: ingredient.quantity,
							unit: ingredient.unit,
							...(ingredient.optional ? { optional: true } : {})
						})),
						steps: recipe.steps.map((step) => (step.verb ? `${step.verb} ${step.text}` : step.text))
					}
				};
			}
		}),
		needs_you: defineTool('needs_you', {
			run: async () => ({ result: needsYouResult(await c.needsYou().list(actor, now, timeZone)) })
		}),
		habits: defineTool('habits', {
			run: async () => ({ result: habitsResult(await c.kitchen().getHabits(actor, timeZone)) })
		}),
		navigate_to: defineTool('navigate_to', {
			run: async ({ door, recipeId }) => ({
				result: { shownOnScreen: true },
				clientAction: { tool: 'navigate_to', door: door ?? null, recipeId: recipeId ?? null }
			})
		}),
		highlight: defineTool('highlight', {
			run: async ({ key }) => ({
				result: { shownOnScreen: true },
				clientAction: { tool: 'highlight', key }
			})
		}),

		// ─── Proposal ───────────────────────────────────────────────────
		suggest_ideas: defineTool('suggest_ideas', {
			run: async ({ tags }) => ({
				result: {
					ideas: (await c.tonight().alternatives(actor, now, timeZone, tags ?? [])).map(ideaResult)
				}
			})
		}),
		use_up_ideas: defineTool('use_up_ideas', {
			run: async ({ itemKey }) => ({
				result: {
					ideas: (await c.useItUp().ideas(actor, itemKey, now, timeZone)).map(ideaResult)
				}
			})
		}),
		suggest_plan_rest: defineTool('suggest_plan_rest', {
			run: async () => {
				const view = await c.plan().getPlan(actor, now, timeZone);
				const open = planResult(view).openSlots;
				const first = view.gaps[0];
				const ideas = first
					? await c.plan().ideas(actor, now, timeZone, { day: first.day, mealType: first.mealType })
					: [];
				return { result: { openSlots: open, ideas: ideas.map(ideaResult) } };
			}
		}),

		// ─── Mutation ───────────────────────────────────────────────────
		eat_out_tonight: defineTool('eat_out_tonight', {
			doors: ['tonight', 'plan', 'shop', 'use-it-up'],
			preview: async () => {
				const view = await c.tonight().getTonight(actor, now, timeZone);
				if (view.state === 'out') throw new Error('Tonight is already marked as eating out');
				return view.meal && !view.tomorrow
					? `Eat out tonight, and move ${lower(view.meal.title)} to another day.`
					: 'Eat out tonight.';
			},
			run: async () => {
				const result = await c.tonight().eatOut(actor, now, timeZone);
				return { result, touched: [tonightTouched(result.title ?? 'Tonight')] };
			}
		}),
		eat_in_tonight: defineTool('eat_in_tonight', {
			doors: ['tonight', 'plan', 'shop'],
			preview: async () => {
				const view = await c.tonight().getTonight(actor, now, timeZone);
				if (view.state !== 'out') throw new Error('Tonight is not marked as eating out');
				return 'Eat in tonight after all.';
			},
			run: async () => ({
				result: await c.tonight().eatIn(actor, now, timeZone),
				touched: [tonightTouched('Tonight')]
			})
		}),
		pick_tonight: defineTool('pick_tonight', {
			doors: PLAN_DOORS,
			preview: async ({ recipeId }) =>
				`Cook ${lower((await ownRecipe(recipeId)).title)} tonight instead.`,
			run: async ({ recipeId }) => {
				const result = await c.tonight().pickAlternative(actor, recipeId, now, timeZone);
				return { result, touched: [tonightTouched(result.title)] };
			}
		}),
		mark_cooked: defineTool('mark_cooked', {
			doors: ['tonight', 'plan', 'shop', 'use-it-up'],
			preview: async (input) => {
				const title = input.plannedMealId
					? (await plannedSlot(input.plannedMealId)).meal.title
					: (await ownRecipe(input.recipeId as string)).title;
				return `Mark ${lower(title)} as cooked and eaten.`;
			},
			run: async (input) => {
				const target = input.plannedMealId
					? { plannedMealId: input.plannedMealId }
					: { recipeId: input.recipeId as string };
				const result = await c.tonight().cook(actor, target, now, timeZone);
				return { result, touched: [tonightTouched(result.title)] };
			}
		}),
		set_plan_slot: defineTool('set_plan_slot', {
			doors: PLAN_DOORS,
			preview: async ({ daysFromToday, meal, recipeId }) => {
				const recipe = await ownRecipe(recipeId);
				const day = possessive(dayLabel(today + daysFromToday, today));
				return `Put ${lower(recipe.title)} on ${day} ${meal.toLowerCase()}.`;
			},
			run: async ({ daysFromToday, meal, recipeId }) => {
				const recipe = await ownRecipe(recipeId);
				const day = today + daysFromToday;
				const result = await c.plan().setSlot(actor, timeZone, { day, mealType: meal, recipeId });
				return { result, touched: [slotTouched(day, meal, recipe.title)] };
			}
		}),
		remove_plan_slot: defineTool('remove_plan_slot', {
			doors: PLAN_DOORS,
			preview: async ({ plannedMealId }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				return `Take ${lower(meal.title)} off ${possessive(dayLabel(slot.day, today))} ${slot.mealType.toLowerCase()}.`;
			},
			run: async ({ plannedMealId }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				const result = await c.plan().removeSlot(actor, plannedMealId);
				return { result, touched: [slotTouched(slot.day, slot.mealType, meal.title)] };
			}
		}),
		cook_for_two_days: defineTool('cook_for_two_days', {
			doors: PLAN_DOORS,
			preview: async ({ plannedMealId }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				const day = dayLabel(slot.day, today);
				return meal.withLunch
					? `Cook ${lower(meal.title)} just for ${day} again.`
					: `Cook ${lower(meal.title)} for two days, so ${dayLabel(slot.day + 1, today)}’s lunch is sorted.`;
			},
			run: async ({ plannedMealId }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				const result = await c.plan().cookForTwoDays(actor, timeZone, plannedMealId);
				return { result, touched: [slotTouched(slot.day, slot.mealType, meal.title)] };
			}
		}),
		fill_plan_rest: defineTool('fill_plan_rest', {
			doors: PLAN_DOORS,
			preview: async () => {
				const open = (await c.plan().getPlan(actor, now, timeZone)).gaps.length;
				if (open === 0) throw new Error('Every slot in these days is already planned');
				return `Fill the ${open} open ${open === 1 ? 'slot' : 'slots'} in the plan with recipes that suit everyone.`;
			},
			run: async () => {
				const before = await c.plan().getPlan(actor, now, timeZone);
				const result = await c.plan().suggestRest(actor, now, timeZone);
				const after = await c.plan().getPlan(actor, now, timeZone);
				const wasOpen = new Set(before.gaps.map((gap) => `${gap.day}:${gap.mealType}`));
				const touched = after.slots
					.filter((slot) => slot.meal && wasOpen.has(`${slot.day}:${slot.mealType}`))
					.map((slot) => slotTouched(slot.day, slot.mealType, slot.meal?.title ?? ''));
				return { result, touched };
			}
		}),
		guests_for_meal: defineTool('guests_for_meal', {
			doors: PLAN_DOORS,
			preview: async ({ plannedMealId, servings }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				return `Make ${possessive(dayLabel(slot.day, today))} ${lower(meal.title)} for ${servings}.`;
			},
			run: async ({ plannedMealId, servings }) => {
				const { slot, meal } = await plannedSlot(plannedMealId);
				const result = await c.plan().setServings(actor, plannedMealId, servings);
				return {
					result,
					touched: [slotTouched(slot.day, slot.mealType, `${meal.title} for ${servings}`)]
				};
			}
		}),
		add_to_list: defineTool('add_to_list', {
			doors: ['shop'],
			preview: async ({ items }) =>
				`Add ${joinNames(items.map((item) => lower(item.name)))} to the list.`,
			run: async ({ items }) => {
				for (const item of items) {
					await c.shop().addItem(actor, {
						name: item.name,
						quantity: item.quantity ?? null,
						unit: item.unit ?? null
					});
				}
				return {
					result: { added: items.map((item) => item.name) },
					touched: items.map((item) => ({
						kind: 'list-item' as const,
						id: item.name,
						label: item.name,
						door: 'shop' as const,
						key: basilKey.shopManual()
					}))
				};
			}
		}),
		remove_from_list: defineTool('remove_from_list', {
			doors: ['shop'],
			preview: async ({ itemId }) => {
				const { item, manual } = await listItem(itemId);
				if (!manual) {
					throw new Error(
						`${item.name} is on the list for a planned meal or as a usual; it goes when the plan or the kitchen changes`
					);
				}
				return `Take ${lower(item.name)} off the list.`;
			},
			run: async ({ itemId }) => {
				const removed = await c.shop().removeItem(actor, itemId);
				return {
					result: { removed: removed.name },
					touched: [{ kind: 'list-item', id: itemId, label: removed.name, door: 'shop' }]
				};
			}
		}),
		tick_item: defineTool('tick_item', {
			doors: ['shop'],
			preview: async ({ itemId, checked }) => {
				const { item } = await listItem(itemId);
				return checked ? `Tick ${lower(item.name)} off the list.` : `Untick ${lower(item.name)}.`;
			},
			run: async ({ itemId, checked }) => {
				const { item, key } = await listItem(itemId);
				await c.shop().toggleItem(actor, itemId, checked);
				return {
					result: { name: item.name, ticked: checked },
					touched: [{ kind: 'list-item', id: itemId, label: item.name, door: 'shop', key }]
				};
			}
		}),
		mark_gone: defineTool('mark_gone', {
			doors: KITCHEN_DOORS,
			preview: async ({ itemKey }) =>
				`Mark the ${lower((await kitchenItem(itemKey)).name)} as gone.`,
			run: async ({ itemKey }) => {
				const item = await kitchenItem(itemKey);
				const result = await c.useItUp().markGone(actor, itemKey, now, timeZone);
				return {
					result: { message: result.message },
					touched: [kitchenTouched(itemKey, item.name)]
				};
			}
		}),
		still_good: defineTool('still_good', {
			doors: KITCHEN_DOORS,
			preview: async ({ itemKey }) =>
				`Keep the ${lower((await kitchenItem(itemKey)).name)}: it’s still good.`,
			run: async ({ itemKey }) => {
				const item = await kitchenItem(itemKey);
				const result = await c.useItUp().stillGood(actor, itemKey, now, timeZone);
				return {
					result: { message: result.message },
					touched: [kitchenTouched(itemKey, item.name)]
				};
			}
		}),
		set_amount_left: defineTool('set_amount_left', {
			doors: KITCHEN_DOORS,
			preview: async ({ itemKey, quantity, unit }) => {
				const item = await kitchenItem(itemKey);
				const amount =
					quantity === 0
						? 'none left'
						: `${quantity}${unit ? ` ${unit}` : item.unit ? ` ${item.unit}` : ''} left`;
				return `Set the ${lower(item.name)} to ${amount}.`;
			},
			run: async ({ itemKey, quantity, unit }) => {
				const item = await kitchenItem(itemKey);
				const result = await c
					.useItUp()
					.setQuantity(actor, { itemKey, quantity, unit: unit ?? null }, now, timeZone);
				return {
					result: { message: result.message },
					touched: [kitchenTouched(itemKey, item.name)]
				};
			}
		}),
		add_to_kitchen: defineTool('add_to_kitchen', {
			doors: KITCHEN_DOORS,
			preview: async ({ name, quantity, unit }) =>
				`Add ${quantity ? `${quantity}${unit ? ` ${unit}` : ''} ` : ''}${lower(name)} to the kitchen.`,
			run: async ({ name, quantity, unit, category }) => {
				const result = await c
					.useItUp()
					.addItem(
						actor,
						{ name, quantity: quantity ?? null, unit: unit ?? null, category: category ?? null },
						now
					);
				return {
					result: { message: result.message },
					touched: [{ kind: 'kitchen-item', id: name, label: name, door: 'use-it-up' }]
				};
			}
		}),
		make_recipe_from_craving: defineTool('make_recipe_from_craving', {
			doors: ['recipes'],
			preview: async ({ craving }) => `Make up a new recipe for “${craving}”.`,
			run: async ({ craving }) => {
				const card = await c.recipesDoor().craving(actor, craving, []);
				return {
					result: {
						recipeId: card.id,
						title: card.title,
						minutes: card.totalMinutes,
						usesFromHome: card.uses,
						toBuy: card.need
					},
					touched: [{ kind: 'recipe', id: card.id, label: card.title, door: 'recipes' }]
				};
			}
		}),
		save_recipe: defineTool('save_recipe', {
			doors: ['recipes'],
			preview: async ({ recipeId }) =>
				`Save ${lower((await visibleRecipe(recipeId)).title)} to your recipes.`,
			run: async ({ recipeId }) => {
				const recipe = await visibleRecipe(recipeId);
				await c.recipe().saveRecipe(actor, recipeId);
				return {
					result: { saved: recipe.title },
					touched: [{ kind: 'recipe', id: recipe.id, label: recipe.title, door: 'recipes' }]
				};
			}
		}),
		unsave_recipe: defineTool('unsave_recipe', {
			doors: ['recipes'],
			preview: async ({ recipeId }) =>
				`Take ${lower((await visibleRecipe(recipeId)).title)} out of your saved recipes.`,
			run: async ({ recipeId }) => {
				const recipe = await visibleRecipe(recipeId);
				await c.recipe().unsaveRecipe(actor, recipeId);
				return {
					result: { unsaved: recipe.title },
					touched: [{ kind: 'recipe', id: recipe.id, label: recipe.title, door: 'recipes' }]
				};
			}
		})
	} satisfies { readonly [N in ToolName]: AgentTool<N> };
}

/** "feta", "feta and eggs", "feta, eggs and milk". */
function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

type Total<T extends never> = T;
type BuiltToolName = keyof ReturnType<typeof agentToolBuilders>;
/** Every catalog tool has a builder. */
export type _BuildersCoverCatalog = Total<Exclude<ToolName, BuiltToolName>>;
/** No builder makes a tool the catalog does not have. */
export type _BuildersNameNothingElse = Total<Exclude<BuiltToolName, ToolName>>;

/** The member's tools as the loop takes them. */
export function agentToolbox(controllers: AgentToolControllers, scope: ToolScope): AgentToolbox {
	return Object.values(agentToolBuilders(controllers, scope));
}
