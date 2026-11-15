import type {
	IHabitService,
	IHouseholdEventService,
	IHouseholdService,
	IKitchenService,
	INeedsYouService,
	IPlanService,
	IShopService
} from '$services';
import type { PlannedMealDao } from '$repositories';
import type { Actor } from '$lib/models/household';
import { MEAL_HOUR } from '$lib/models/plan';
import type { MealNeed } from '$lib/models/kitchen';
import type { AnswerInput, AnswerResult, NeedsYouItem, NeedsYouView } from '$lib/models/needsyou';
import { dayNumber, forecastMeals, localHour, normalizeItemKey } from '$lib/services/kitchen';
import {
	collectNeedsYou,
	HOUSEHOLD_EVENT_HOURS,
	type NeedsYouContext,
	type NeedsYouMeal
} from '$lib/services/needsyou';
import {
	firstName,
	sameItem,
	spokenName,
	tonightTarget,
	withPerishable
} from '$lib/services/tonight';

/** The rules read the plan this many days ahead. */
const PLAN_AHEAD_DAYS = 4;

/**
 * "Got everything" as the Shop door runs it. `ShopController` provides it, so closing a shop
 * from "Needs you" does exactly what the Shop door's button does.
 */
export interface ShopCloser {
	gotEverything(actor: Actor, now: Date, timeZone: string): Promise<{ message: string }>;
}

const SHOP_DAYS_ACCEPTED =
	'Done. Plans now run from one shop to the next, and fresh things wait for the later shop.';
const SHOP_DAYS_NOT_NOW = 'No problem. You’ll still get a heads-up when a meal needs something.';

/** Every question the app has for the member, and the answers to them. */
export class NeedsYouController {
	constructor(
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private planService: IPlanService,
		private householdService: IHouseholdService,
		private householdEventService: IHouseholdEventService,
		private needsYouService: INeedsYouService,
		private shopService: IShopService,
		private shopCloser: ShopCloser
	) {}

	async list(actor: Actor, now: Date, timeZone: string): Promise<NeedsYouView> {
		const items = collectNeedsYou(await this.load(actor, now, timeZone));
		return { items, count: items.length };
	}

	/**
	 * Runs the action the member picked on one item and records the answer, so the question is
	 * not asked again. The item is found again from its key, so only an action the item offers
	 * now can run.
	 */
	async answer(
		actor: Actor,
		input: AnswerInput,
		now: Date,
		timeZone: string
	): Promise<AnswerResult> {
		const { items } = await this.list(actor, now, timeZone);
		const item = items.find((candidate) => candidate.key === input.key);
		if (!item || !item.actions.some((action) => action.command === input.command)) {
			throw new Error('Question not found');
		}
		const message = await this.run(actor, item, input.command, now, timeZone);
		if (input.command !== 'open' || item.kind === 'HouseholdEvent') {
			await this.needsYouService.recordAnswer(actor, item.key, input.command, now);
		}
		return { message };
	}

	private async run(
		actor: Actor,
		item: NeedsYouItem,
		command: AnswerInput['command'],
		now: Date,
		timeZone: string
	): Promise<string> {
		switch (command) {
			case 'kitchen.gone':
			case 'kitchen.stillGood': {
				if (
					item.kind !== 'StillGotForTonight' &&
					item.kind !== 'ProbablyGoneOff' &&
					item.kind !== 'GoesOffToday'
				) {
					throw new Error('Question not found');
				}
				const picture = await this.kitchenService.getPicture(actor.householdId, now, timeZone);
				const name =
					picture.stock.find((stock) => stock.itemKey === item.itemKey)?.name ?? item.itemKey;
				const gone = command === 'kitchen.gone';
				await this.kitchenService.correct({
					actor,
					itemKey: item.itemKey,
					kind: gone ? 'CORRECTED_GONE' : 'CORRECTED_STILL_GOOD',
					name,
					at: now
				});
				if (item.kind === 'StillGotForTonight') {
					return gone ? `Thanks. ${name} is off the kitchen.` : 'Good. Tonight’s on.';
				}
				return gone
					? `${name} gone. If anything planned needed it, it’s on the list.`
					: `${name} is still good. Noted.`;
			}
			case 'tonight.quickGet': {
				if (item.kind !== 'MissingBeforeMeal') throw new Error('Question not found');
				for (const name of item.missing) {
					await this.shopService.addManual(actor, { name: name[0].toUpperCase() + name.slice(1) });
				}
				return `On your way home. ${item.mealLabel} is safe.`;
			}
			case 'habit.acceptShopDays': {
				if (item.kind !== 'ShopDayOffer') throw new Error('Question not found');
				for (const weekday of item.weekdays) {
					await this.habitService.answerOffer(actor, `shopDay:${weekday}`, 'accepted', now);
				}
				return SHOP_DAYS_ACCEPTED;
			}
			case 'shop.gotEverything':
				return (await this.shopCloser.gotEverything(actor, now, timeZone)).message;
			case 'dismiss':
				return item.kind === 'ShopDayOffer' ? SHOP_DAYS_NOT_NOW : '';
			case 'open':
				return '';
		}
	}

	private async load(actor: Actor, now: Date, timeZone: string): Promise<NeedsYouContext> {
		const today = dayNumber(now, timeZone);
		const [picture, habits, meals, cookbook, members, events, answered] = await Promise.all([
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.habitService.getHabits(actor.householdId, now, timeZone),
			this.planService.listMeals(actor.householdId, today, today + PLAN_AHEAD_DAYS, timeZone),
			this.planService.getCookbook(actor, now),
			this.householdService.listMembers(actor),
			this.householdEventService.recent(actor.householdId, now, HOUSEHOLD_EVENT_HOURS),
			this.needsYouService.answeredKeys(actor)
		]);
		const hour = localHour(now, timeZone);
		const stock = withPerishable(picture.stock, picture.lots, today);
		const stockKeys = stock.map((item) => item.itemKey);
		const recipes = new Map(cookbook.recipes.map((recipe) => [recipe.id, recipe]));

		const ingredientsOf = (meal: PlannedMealDao) => {
			const recipe = meal.recipeId ? recipes.get(meal.recipeId) : undefined;
			if (!recipe) return [];
			const factor = (meal.servings ?? recipe.servings) / (recipe.servings || 1);
			return recipe.ingredients
				.filter((ingredient) => !ingredient.optional)
				.map((ingredient) => {
					const key = normalizeItemKey(ingredient.name);
					return {
						itemKey: stockKeys.find((stockKey) => sameItem(stockKey, key)) ?? key,
						name: ingredient.name.trim(),
						quantity: (parseFloat(ingredient.quantity) || 0) * factor,
						unit: ingredient.unit
					};
				});
		};
		const missing = this.forecast(meals, ingredientsOf, picture.lots, today, timeZone);
		const toMeal = (meal: PlannedMealDao): NeedsYouMeal => {
			const day = dayNumber(meal.plannedDate, timeZone);
			const ingredients = ingredientsOf(meal);
			const source = meal.recipeId ? (recipes.get(meal.recipeId)?.ingredients ?? []) : [];
			return {
				id: meal.id,
				title: meal.mealName,
				day,
				mealType: meal.mealType,
				status: meal.status,
				isPrep: meal.isPrep,
				leftover: meal.leftoverOfId !== null,
				hoursAway: (day - today) * 24 + MEAL_HOUR[meal.mealType] - hour,
				ingredients: ingredients.map(({ itemKey, name }) => ({ itemKey, name })),
				missing: picture.tracks
					? (missing.get(meal.id) ?? [])
							.filter((key) => !key.startsWith('leftover:'))
							.map((key) => spokenName(key, source))
					: []
			};
		};

		const target = tonightTarget(meals, now, timeZone);
		const viewer = members.find((member) => member.userId === actor.userId);
		return {
			now,
			timeZone,
			today,
			hour,
			viewer: {
				userId: actor.userId,
				memberId: actor.memberId,
				shops: viewer?.roles.shops ?? actor.roles.shops
			},
			members: members.map((member) => ({
				userId: member.userId,
				firstName: firstName(member.displayName)
			})),
			tracks: picture.tracks,
			stock,
			tonight:
				target.meal && !target.eaten && !target.out && target.meal.status === 'PLANNED'
					? toMeal(target.meal)
					: null,
			meals: meals.map(toMeal).sort((a, b) => a.hoursAway - b.hoursAway),
			dinnerDays: meals
				.filter((meal) => meal.mealType === 'DINNER' && meal.status !== 'SKIPPED')
				.map((meal) => dayNumber(meal.plannedDate, timeZone)),
			habits,
			lastShopDoneAt: picture.lastShopDoneAt,
			events,
			answered
		};
	}

	/** Item keys each planned meal will be short of, walking the meals in order. */
	private forecast(
		meals: PlannedMealDao[],
		ingredientsOf: (meal: PlannedMealDao) => MealNeed['ingredients'],
		lots: Parameters<typeof forecastMeals>[0],
		today: number,
		timeZone: string
	): Map<string, string[]> {
		const needs: MealNeed[] = meals
			.filter((meal) => meal.status === 'PLANNED' && meal.recipeId)
			.map((meal) => ({
				id: meal.id,
				day: dayNumber(meal.plannedDate, timeZone),
				ingredients: ingredientsOf(meal)
			}));
		const out = new Map<string, string[]>();
		for (const result of forecastMeals(lots, needs, today, today + PLAN_AHEAD_DAYS)) {
			out.set(
				result.meal.id,
				result.missing.map((item) => item.itemKey)
			);
		}
		return out;
	}
}
