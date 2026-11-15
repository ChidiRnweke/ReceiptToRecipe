/**
 * What Basil's read tools hand the model: the doors' views cut down to what answers a question,
 * with the ids the change tools take and the `basilKey` the highlight tool takes.
 */

import type { Habits } from '$lib/models/kitchen';
import type { HomeItem, UseItUpIdea, UseItUpView } from '$lib/models/useitup';
import type { PlanIdea, PlanView } from '$lib/models/plan';
import type { ShopView } from '$lib/models/shop';
import type { TonightIdea, TonightView } from '$lib/models/tonight';
import type { NeedsYouView } from '$lib/models/needsyou';
import type { CookbookCard, MyRecipes } from '$lib/models/recipes';
import { WEEKDAY_NAMES } from '$lib/services/tonight';
import { basilKey } from '$lib/models/agent';

export function tonightResult(view: TonightView) {
	return {
		basilKey: basilKey.tonightCard(),
		answersFor: view.tomorrow ? 'tomorrow' : 'tonight',
		slot: view.slot,
		state: view.state,
		meal: view.meal
			? {
					plannedMealId: view.meal.plannedMealId,
					recipeId: view.meal.recipeId,
					title: view.meal.title,
					minutes: view.meal.minutes,
					servings: view.meal.servings,
					usesUp: view.meal.uses,
					missing: view.meal.missing,
					kitchenNotTracked: view.meal.untracked
				}
			: null,
		ideas: view.ideas.map(ideaResult),
		tomorrow: view.tomorrowLine,
		caloriesLeftToday: view.calorieLeft
	};
}

export function ideaResult(idea: TonightIdea | PlanIdea | UseItUpIdea) {
	return {
		recipeId: idea.recipeId,
		title: idea.title,
		minutes: idea.minutes,
		usesUp: idea.uses,
		missing: idea.missing
	};
}

export function homeItemResult(item: HomeItem) {
	return {
		itemKey: item.itemKey,
		name: item.name,
		amount: item.known ? item.amount : `about ${item.amount}`,
		estimate: !item.known,
		goneOff: item.off,
		daysLeft: item.perishable || item.leftover ? item.daysLeft : null,
		leftover: item.leftover,
		basilKey: basilKey.kitchenItem(item.itemKey)
	};
}

export function eatFirstResult(view: UseItUpView) {
	return {
		tracksKitchen: view.tracks,
		putAtTheFront: view.frontNames,
		eatFirst: view.eatFirst.map(homeItemResult)
	};
}

/** Days of the plan as offsets from today, which is how the plan tools take them. */
export function planResult(view: PlanView) {
	const weekday = (day: number) => WEEKDAY_NAMES[((((day + 3) % 7) + 7) % 7) as 0];
	return {
		planningStyle: view.style,
		slots: view.slots.map((slot) => ({
			daysFromToday: slot.day - view.today,
			weekday: weekday(slot.day),
			meal: slot.mealType,
			basilKey: basilKey.planSlot(slot.day, slot.mealType),
			planned: slot.meal
				? {
						plannedMealId: slot.meal.plannedMealId,
						recipeId: slot.meal.recipeId,
						title: slot.meal.title,
						servings: slot.meal.servings,
						leftoverFromThePot: slot.meal.fromThePot,
						cookedForTwoDays: slot.meal.withLunch,
						keepsWell: slot.meal.keepsWell,
						prep: slot.meal.isPrep
					}
				: null
		})),
		openSlots: view.gaps.map((gap) => ({
			daysFromToday: gap.day - view.today,
			weekday: weekday(gap.day),
			meal: gap.mealType
		})),
		thingsToBuy: view.toBuy,
		prepDay: view.prep ? weekday(view.prep.day) : null
	};
}

export function shopResult(view: ShopView) {
	const item = (entry: ShopView['usuals'][number]) => ({
		itemId: entry.id,
		name: entry.name,
		amount: entry.amount || null,
		ticked: entry.checked,
		alsoNeededOn: entry.also,
		...(entry.atHome ? { mayBeAtHomeAlready: true } : {})
	});
	return {
		title: view.title,
		count: view.count,
		forDishes: view.groups.map((group) => ({
			plannedMealId: group.mealId,
			dish: group.title,
			when: group.when,
			basilKey: basilKey.shopGroup(group.mealId),
			items: group.items.map(item)
		})),
		usualsRunningLow: view.usuals.map(item),
		addedByHand: view.manual.map(item),
		heldForTheShopAfter: view.held
			? { shop: view.held.shop, items: view.held.items.map((held) => held.name) }
			: null
	};
}

/** Which planned dishes need an item, from the list's groups; matched loosely on the name. */
export function whyOnListResult(view: ShopView, asked: string) {
	const words = asked.toLowerCase().trim();
	const matches = (name: string) => {
		const lower = name.toLowerCase();
		return lower.includes(words) || words.includes(lower) || stem(lower) === stem(words);
	};
	const forDishes = view.groups.flatMap((group) =>
		group.items
			.filter((entry) => matches(entry.name))
			.map((entry) => ({
				item: entry.name,
				amount: entry.amount || null,
				dish: group.title,
				when: group.when,
				alsoNeededOn: entry.also,
				basilKey: basilKey.shopGroup(group.mealId)
			}))
	);
	const usual = view.usuals.filter((entry) => matches(entry.name)).map((entry) => entry.name);
	const manual = view.manual.filter((entry) => matches(entry.name)).map((entry) => entry.name);
	const onList = forDishes.length > 0 || usual.length > 0 || manual.length > 0;
	return {
		onList,
		forDishes,
		usualRunningLow: usual,
		addedByHand: manual,
		...(onList ? {} : { note: `Nothing called "${asked}" is on the list right now.` })
	};
}

function stem(word: string): string {
	return word.replace(/(es|s)$/, '');
}

export function needsYouResult(view: NeedsYouView) {
	return { count: view.count, questions: view.items.map((item) => item.text) };
}

export function habitsResult(habits: Habits) {
	return {
		shopDays: habits.shopDays.map((day) => ({
			weekday: WEEKDAY_NAMES[day.weekday],
			hour: day.hour,
			confirmed: day.confirmed ?? false
		})),
		prepDay: habits.prepDay === null ? null : WEEKDAY_NAMES[habits.prepDay],
		planningStyle: habits.planningStyle,
		usuals: habits.usuals
	};
}

export function recipesResult(recipes: MyRecipes, query: string | undefined) {
	const words = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
	const rows = recipes.rows.filter((row) =>
		words.every((word) => row.title.toLowerCase().includes(word))
	);
	return {
		tab: recipes.tab,
		found: rows.length,
		recipes: rows.slice(0, 15).map((row) => ({
			recipeId: row.id,
			title: row.title,
			minutes: row.totalMinutes,
			source: row.source,
			tags: row.tags
		}))
	};
}

/** Shared-cookbook recipes as find_cookbook_recipes returns them. */
export function cookbookResult(cards: CookbookCard[]) {
	return {
		found: cards.length,
		recipes: cards.map((card) => ({
			recipeId: card.id,
			title: card.title,
			minutes: card.totalMinutes,
			cuisine: card.cuisine,
			tags: card.tags,
			source: 'Wikibooks Cookbook'
		}))
	};
}
