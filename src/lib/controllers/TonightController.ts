import type {
	Cookbook,
	IHabitService,
	IHouseholdService,
	IKitchenService,
	INutritionService,
	IPlanService,
	KitchenPicture
} from '$services';
import type { PlannedMealDao, RecipeWithIngredientsDao } from '$repositories';
import type { Actor, HouseholdMember } from '$lib/models/household';
import type { Habits, MealNeed } from '$lib/models/kitchen';
import { normalizeItemKey } from '$lib/services/kitchen/itemKey';
import { MEAL_HOUR, type MealType, type PlanRecipe } from '$lib/models/plan';
import type {
	CookIngredient,
	CookResult,
	EatOutResult,
	PickResult,
	ShopBefore,
	TonightIdea,
	TonightMeal,
	TonightView
} from '$lib/models/tonight';
import { greetingFor } from '$lib/services/doors';
import {
	dayNumber,
	forecastMeals,
	localHour,
	weekdayOf,
	weekdayOfDay
} from '$lib/services/kitchen';
import { upcomingShops } from '$lib/services/plan';
import {
	calorieLeft,
	eatOutMessage,
	firstName,
	pickMessage,
	PLANNED_SOON_DAYS,
	rankIdeas,
	sameItem,
	spokenName,
	splitSteps,
	tonightQuestion,
	tonightTarget,
	withPerishable,
	DINNER_UNTIL_HOUR,
	type PickCopy,
	type RankStock,
	type RankedIdea,
	type TonightTarget
} from '$lib/services/tonight';

/** Tonight reads the plan this many days ahead. */
const PLAN_AHEAD_DAYS = 7;
/** A planned meal "uses" a perishable that goes off within this many days of the meal. */
const MEAL_USES_WITHIN_DAYS = 1;
const IDEA_COUNT = 3;
const ALTERNATIVE_COUNT = 5;

/** A recipe with its ingredient keys matched to the kitchen's item keys. */
interface CookRecipe extends PlanRecipe {
	source: RecipeWithIngredientsDao;
}

/** Everything Tonight reads for one request. */
interface TonightContext {
	today: number;
	timeZone: string;
	meals: PlannedMealDao[];
	cookbook: Cookbook;
	recipes: CookRecipe[];
	picture: KitchenPicture;
	stock: RankStock[];
	habits: Habits;
	target: TonightTarget<PlannedMealDao>;
	/** Who shops, when it is someone else in a household of several; else null. */
	shopper: string | null;
}

export type CookTarget = { plannedMealId: string } | { recipeId: string };

/** Turns recipe ingredients into plan ingredients, named as the kitchen names them. */
function toCookRecipe(recipe: RecipeWithIngredientsDao, stockKeys: string[]): CookRecipe {
	return {
		id: recipe.id,
		title: recipe.title,
		source: recipe,
		ingredients: recipe.ingredients
			.filter((ingredient) => !ingredient.optional)
			.map((ingredient) => {
				const key = normalizeItemKey(ingredient.name);
				return {
					itemKey: stockKeys.find((stockKey) => sameItem(stockKey, key)) ?? key,
					quantity: parseFloat(ingredient.quantity) || 0,
					unit: ingredient.unit
				};
			})
	};
}

/** In a household of several, the first name of the member who shops when the viewer does not. */
function otherShopper(actor: Actor, members: HouseholdMember[]): string | null {
	if (members.length < 2 || actor.roles.shops) return null;
	const shopper = members.find((member) => member.roles.shops && member.userId !== actor.userId);
	return shopper ? firstName(shopper.displayName) : null;
}

function minutesOf(recipe: RecipeWithIngredientsDao): number | null {
	if (recipe.prepTime === null && recipe.cookTime === null) return null;
	return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

/** What the Tonight door shows, and what its buttons do. */
export class TonightController {
	constructor(
		private planService: IPlanService,
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private nutritionService: INutritionService,
		private householdService: IHouseholdService
	) {}

	async getTonight(actor: Actor, now: Date, timeZone: string): Promise<TonightView> {
		const [ctx, calories] = await Promise.all([
			this.load(actor, now, timeZone),
			this.nutritionService.getCaloriesToday(actor, now, timeZone)
		]);
		const { target } = ctx;
		const missingByMeal = this.forecast(ctx, timeZone);
		const meal = target.meal ? this.toMeal(ctx, target.meal, missingByMeal, now, timeZone) : null;

		const state = !meal ? 'ideas' : target.eaten ? 'eaten' : target.out ? 'out' : 'planned';
		const ideas =
			state === 'ideas'
				? this.rank(ctx, { limit: IDEA_COUNT }).map((idea) => this.toIdea(idea))
				: [];

		return {
			greeting: greetingFor(Math.floor(localHour(now, timeZone)), firstName(actor.displayName)),
			question: tonightQuestion(target.slot, target.tomorrow),
			slot: target.slot,
			tomorrow: target.tomorrow,
			state,
			meal,
			ideas,
			tomorrowLine: this.tomorrowLine(ctx, missingByMeal, now, timeZone),
			calorieLeft: calorieLeft(calories.goal, calories.eaten)
		};
	}

	/** Five ideas instead of the planned meal. */
	async alternatives(actor: Actor, now: Date, timeZone: string): Promise<TonightIdea[]> {
		const ctx = await this.load(actor, now, timeZone);
		const planned = ctx.target.meal?.recipeId;
		return this.rank(ctx, { limit: ALTERNATIVE_COUNT, exclude: planned ? [planned] : [] }).map(
			(idea) => this.toIdea(idea)
		);
	}

	/** Records the meal as cooked; a recipe on its own becomes today's dinner first. */
	async cook(actor: Actor, target: CookTarget, now: Date, timeZone: string): Promise<CookResult> {
		const plannedMealId =
			'plannedMealId' in target
				? target.plannedMealId
				: (
						await this.planService.planMeal(
							actor,
							target.recipeId,
							dayNumber(now, timeZone),
							'DINNER',
							timeZone
						)
					).id;
		const { meal, recipe } = await this.planService.getMeal(actor.householdId, plannedMealId);
		if (!recipe) throw new Error('Recipe not found');
		await this.kitchenService.recordCooked({
			actor,
			plannedMealId: meal.id,
			recipeId: recipe.id,
			servings: meal.servings ?? recipe.servings,
			at: now
		});
		return { plannedMealId: meal.id, title: recipe.title };
	}

	/** Plans the recipe for the target meal; the meal it replaces moves to the next free day. */
	async pickAlternative(
		actor: Actor,
		recipeId: string,
		now: Date,
		timeZone: string
	): Promise<PickResult> {
		const ctx = await this.load(actor, now, timeZone);
		const { target } = ctx;
		const recipe = ctx.recipes.find((r) => r.id === recipeId);
		if (!recipe) throw new Error('Recipe not found');

		let moved: PickCopy['moved'] = null;
		if (target.meal?.status === 'PLANNED' && target.meal.recipeId !== recipeId) {
			const result = await this.planService.moveToNextFreeDay(
				actor.householdId,
				target.meal.id,
				now,
				timeZone
			);
			if (result.movedTo) {
				moved = { title: target.meal.mealName, weekday: weekdayOf(result.movedTo, timeZone) };
			}
		}
		const mealType: MealType = target.slot === 'lunch' ? 'LUNCH' : 'DINNER';
		if (target.meal?.recipeId !== recipeId) {
			await this.planService.planMeal(actor, recipe.id, target.day, mealType, timeZone);
		}

		const [ranked] = this.rank(ctx, { limit: 1, only: recipe.id });
		const missing = ctx.picture.tracks ? (ranked?.missing ?? []) : [];
		return {
			title: recipe.title,
			message: pickMessage({
				title: recipe.title,
				slot: target.slot,
				tomorrow: target.tomorrow,
				moved,
				missing
			})
		};
	}

	/**
	 * Moves tonight's dinner to the next free day. A dinner with nowhere to go is marked eaten
	 * out. With nothing planned, nothing changes.
	 */
	async eatOut(actor: Actor, now: Date, timeZone: string): Promise<EatOutResult> {
		const ctx = await this.load(actor, now, timeZone);
		const { today } = ctx;
		const dinner = ctx.meals.find(
			(meal) =>
				meal.mealType === 'DINNER' &&
				meal.status === 'PLANNED' &&
				dayNumber(meal.plannedDate, timeZone) === today
		);

		if (!dinner) {
			const soon = ctx.stock
				.filter((item) => item.perishable && !item.off && item.expiresOn - today <= 1)
				.sort((a, b) => a.expiresOn - b.expiresOn)[0];
			const result = {
				title: null,
				movedToDays: null,
				movedToWeekday: null,
				keptBy: null,
				firstInLine: soon ? { itemKey: soon.itemKey, tonight: soon.expiresOn === today } : null
			};
			return { ...result, message: eatOutMessage(result) };
		}

		const move = await this.planService.moveToNextFreeDay(
			actor.householdId,
			dinner.id,
			now,
			timeZone,
			{ ifNoDay: 'EATEN_OUT' }
		);
		const result = {
			title: dinner.mealName,
			movedToDays: move.movedTo ? dayNumber(move.movedTo, timeZone) - today : null,
			movedToWeekday: move.movedTo ? weekdayOf(move.movedTo, timeZone) : null,
			keptBy: move.keptBy
				? {
						itemKey: spokenName(
							move.keptBy.itemKey,
							ctx.recipes.find((r) => r.id === dinner.recipeId)?.source.ingredients ?? []
						),
						weekday: weekdayOf(move.keptBy.until, timeZone)
					}
				: null,
			firstInLine: null
		};
		return { ...result, message: eatOutMessage(result) };
	}

	private async load(actor: Actor, now: Date, timeZone: string): Promise<TonightContext> {
		const today = dayNumber(now, timeZone);
		const [meals, cookbook, picture, habits, members] = await Promise.all([
			this.planService.listMeals(actor.householdId, today, today + PLAN_AHEAD_DAYS, timeZone),
			this.planService.getCookbook(actor, now),
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.habitService.getHabits(actor.householdId, now, timeZone),
			this.householdService.listMembers(actor)
		]);
		const stockKeys = picture.stock.map((item) => item.itemKey);
		return {
			today,
			timeZone,
			meals,
			cookbook,
			recipes: cookbook.recipes.map((recipe) => toCookRecipe(recipe, stockKeys)),
			picture,
			stock: withPerishable(picture.stock, picture.lots, today),
			habits,
			target: tonightTarget(meals, now, timeZone),
			shopper: otherShopper(actor, members)
		};
	}

	private rank(
		ctx: TonightContext,
		options: { limit: number; exclude?: string[]; only?: string }
	): RankedIdea<CookRecipe>[] {
		const { today } = ctx;
		const plannedSoon = ctx.meals
			.filter((meal) => meal.recipeId && meal.status === 'PLANNED')
			.filter((meal) => {
				const day = dayNumber(meal.plannedDate, ctx.timeZone);
				return day > today && day <= today + PLANNED_SOON_DAYS;
			})
			.map((meal) => meal.recipeId as string);
		const knownRecipes = new Set(ctx.cookbook.cookedOrSaved);
		const known = ctx.recipes
			.filter((recipe) => knownRecipes.has(recipe.id))
			.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.itemKey));
		const recipes = options.only ? ctx.recipes.filter((r) => r.id === options.only) : ctx.recipes;
		return rankIdeas(recipes, ctx.stock, plannedSoon, {
			day: today,
			tracksKitchen: ctx.picture.tracks,
			known,
			exclude: options.exclude,
			limit: options.limit
		});
	}

	/** Item keys each upcoming planned meal will be short of, walking the meals in order. */
	private forecast(ctx: TonightContext, timeZone: string): Map<string, string[]> {
		const missing = new Map<string, string[]>();
		if (!ctx.picture.tracks) return missing;
		const needs: MealNeed[] = [];
		for (const meal of ctx.meals) {
			const recipe = ctx.recipes.find((r) => r.id === meal.recipeId);
			if (!recipe || meal.status !== 'PLANNED') continue;
			const factor = (meal.servings ?? recipe.source.servings) / (recipe.source.servings || 1);
			needs.push({
				id: meal.id,
				day: dayNumber(meal.plannedDate, timeZone),
				ingredients: recipe.ingredients.map((i) => ({ ...i, quantity: i.quantity * factor }))
			});
		}
		for (const result of forecastMeals(
			ctx.picture.lots,
			needs,
			ctx.today,
			ctx.today + PLAN_AHEAD_DAYS
		)) {
			missing.set(
				result.meal.id,
				result.missing.map((item) => item.itemKey)
			);
		}
		return missing;
	}

	private toIdea(ranked: RankedIdea<CookRecipe>): TonightIdea {
		const { recipe } = ranked;
		return this.describe(recipe, recipe.source.servings, ranked.uses, ranked.missing);
	}

	private describe(
		recipe: CookRecipe,
		servings: number,
		uses: string[],
		missing: string[]
	): TonightIdea {
		const source = recipe.source;
		const factor = servings / (source.servings || 1);
		const ingredients: CookIngredient[] = source.ingredients.map((ingredient) => {
			const key = normalizeItemKey(ingredient.name);
			return {
				name: ingredient.name,
				quantity: (parseFloat(ingredient.quantity) || 0) * factor,
				unit: ingredient.unit,
				missing: missing.some((m) => sameItem(m, key))
			};
		});
		return {
			recipeId: recipe.id,
			title: recipe.title,
			imageUrl: source.imageUrl,
			minutes: minutesOf(source),
			calories: source.estimatedCalories,
			uses: uses.map((key) => spokenName(key, source.ingredients)),
			missing: missing.map((key) => spokenName(key, source.ingredients)),
			servings,
			ingredients,
			steps: splitSteps(source.instructions)
		};
	}

	private toMeal(
		ctx: TonightContext,
		meal: PlannedMealDao,
		missingByMeal: Map<string, string[]>,
		now: Date,
		timeZone: string
	): TonightMeal | null {
		const recipe = ctx.recipes.find((r) => r.id === meal.recipeId);
		if (!recipe) return null;
		const day = dayNumber(meal.plannedDate, timeZone);
		const uses = recipe.ingredients
			.map((ingredient) => ingredient.itemKey)
			.filter((key) => {
				const item = ctx.stock.find((x) => x.itemKey === key && !x.off);
				return item?.perishable && item.expiresOn - day <= MEAL_USES_WITHIN_DAYS;
			});
		const missing = missingByMeal.get(meal.id) ?? [];
		return {
			...this.describe(recipe, meal.servings ?? recipe.source.servings, uses, missing),
			plannedMealId: meal.id,
			untracked: !ctx.picture.tracks,
			shopBefore: missing.length ? this.shopBefore(ctx, meal, day, now, timeZone) : null
		};
	}

	/** The first learned shop between now and the meal. */
	private shopBefore(
		ctx: TonightContext,
		meal: PlannedMealDao,
		day: number,
		now: Date,
		timeZone: string
	): ShopBefore | null {
		const mealHoursAway =
			(day - ctx.today) * 24 + MEAL_HOUR[meal.mealType] - localHour(now, timeZone);
		const shop = upcomingShops(ctx.habits.shopDays, now, timeZone).find(
			(s) => s.hoursAway > 0 && s.hoursAway < mealHoursAway
		);
		return shop
			? { weekday: weekdayOfDay(shop.day), daysAway: shop.day - ctx.today, shopper: ctx.shopper }
			: null;
	}

	private tomorrowLine(
		ctx: TonightContext,
		missingByMeal: Map<string, string[]>,
		now: Date,
		timeZone: string
	): TonightView['tomorrowLine'] {
		if (ctx.target.tomorrow || localHour(now, timeZone) >= DINNER_UNTIL_HOUR) return null;
		const dinner = ctx.meals.find(
			(meal) =>
				meal.mealType === 'DINNER' &&
				meal.status === 'PLANNED' &&
				dayNumber(meal.plannedDate, timeZone) === ctx.today + 1
		);
		if (!dinner) return null;
		return {
			title: dinner.mealName,
			everythingHome: ctx.picture.tracks && (missingByMeal.get(dinner.id) ?? []).length === 0
		};
	}
}
