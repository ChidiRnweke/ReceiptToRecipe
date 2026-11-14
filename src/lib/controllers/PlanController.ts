import type {
	IHabitService,
	IKitchenService,
	INutritionService,
	IPlanService,
	KitchenPicture,
	PlanContext
} from '$services';
import type { PlannedMealDao, RecipeWithIngredientsDao } from '$repositories';
import type { Actor } from '$lib/models/household';
import type { Habits, MealNeed } from '$lib/models/kitchen';
import { normalizeItemKey } from '$lib/services/kitchen/itemKey';
import {
	STRIP_DAYS,
	type PlanIdea,
	type PlanRange,
	type PlanRecipeInfo,
	type PlanResult,
	type PlanSlotType,
	type PlanStretch,
	type PlanView
} from '$lib/models/plan';
import { dayNumber, forecastMeals, weekdayOfDay } from '$lib/services/kitchen';
import {
	batchPrepMessage,
	buildPlanView,
	defaultStretch,
	discoverMessage,
	DINNER_SHARE,
	FILLED_MESSAGE,
	JUST_TONIGHT_MESSAGE,
	NO_RECIPES_MESSAGE,
	NOTHING_TO_FILL_MESSAGE,
	pickedStretch,
	PREP_DONE_MESSAGE,
	setSlotMessage,
	slotTypesFor,
	stretchLine,
	twoDaysMessage
} from '$lib/services/plan';
import { sameItem, spokenName, splitSteps, withPerishable } from '$lib/services/tonight';

/** "Something new" shows this many recipes. */
const DISCOVER_COUNT = 5;
/** The pick sheet shows this many recipes. */
const IDEA_COUNT = 6;
/** A prep planned without picks takes two dishes, two boxes each. */
const PREP_DISHES = 2;
const PREP_LUNCHES_PER_DISH = 2;

export interface SlotInput {
	day: number;
	mealType: PlanSlotType | 'PREP';
	recipeId: string;
	replaceId?: string;
}

export interface IdeasInput {
	day: number;
	mealType: PlanSlotType | 'PREP';
	exclude?: string[];
}

export interface BatchPrepInput {
	day: number;
	recipeIds?: string[];
	lunchesPerRecipe?: number;
}

export interface DiscoverResult extends PlanResult {
	/** False when every dinner in the stretch is planned, so nothing changed. */
	planned: boolean;
}

/** Everything one Plan request reads. */
interface PlanLoad {
	today: number;
	habits: Habits;
	picture: KitchenPicture;
	ctx: PlanContext;
	stretch: PlanStretch;
}

function minutesOf(recipe: RecipeWithIngredientsDao): number | null {
	if (recipe.prepTime === null && recipe.cookTime === null) return null;
	return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

function toInfo(recipe: RecipeWithIngredientsDao): PlanRecipeInfo {
	return {
		id: recipe.id,
		title: recipe.title,
		imageUrl: recipe.imageUrl,
		servings: recipe.servings,
		minutes: minutesOf(recipe),
		calories: recipe.estimatedCalories,
		steps: splitSteps(recipe.instructions)
	};
}

/** What the Plan door shows, and what its buttons do. */
export class PlanController {
	constructor(
		private planService: IPlanService,
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private nutritionService: INutritionService
	) {}

	async getPlan(actor: Actor, now: Date, timeZone: string, range?: PlanRange): Promise<PlanView> {
		const load = await this.load(actor, now, timeZone, range);
		const strip = { start: load.today, end: load.today + STRIP_DAYS };
		const [data, discover] = await Promise.all([
			this.planService.getPlan(actor.householdId, strip, now, timeZone),
			this.planService.discoverNew(actor, DISCOVER_COUNT, load.ctx)
		]);
		return buildPlanView({
			now,
			timeZone,
			displayName: actor.displayName,
			habits: load.habits,
			stretch: load.stretch,
			meals: data.meals,
			recipes: data.recipes.map(toInfo),
			cookedRecipeIds: data.cookedRecipeIds,
			missingByMeal: this.forecast(load, data.meals, data.recipes, timeZone),
			discover
		});
	}

	/** The range the member picked, kept inside the strip, with its line. */
	pickRange(now: Date, timeZone: string, range: PlanRange): PlanStretch & { line: string } {
		const stretch = pickedStretch(range, dayNumber(now, timeZone));
		return { ...stretch, line: stretchLine(stretch) };
	}

	async suggestRest(
		actor: Actor,
		now: Date,
		timeZone: string,
		range?: PlanRange
	): Promise<PlanResult> {
		const load = await this.load(actor, now, timeZone, range);
		const result = await this.planService.suggestRest(actor, load.stretch, load.ctx);
		return { message: this.fillMessage(result.filled, result.open) };
	}

	async planWholeWeek(
		actor: Actor,
		now: Date,
		timeZone: string,
		range?: PlanRange
	): Promise<PlanResult> {
		const load = await this.load(actor, now, timeZone, range);
		const result = await this.planService.planWholeWeek(actor, load.stretch, load.ctx);
		return { message: this.fillMessage(result.filled, result.open) };
	}

	/** Ranked recipes for one slot; a prep slot or a lunch only offers dishes that keep. */
	async ideas(actor: Actor, now: Date, timeZone: string, input: IdeasInput): Promise<PlanIdea[]> {
		const load = await this.load(actor, now, timeZone);
		return this.planService.ideasFor(actor, load.ctx, {
			limit: IDEA_COUNT,
			exclude: input.exclude,
			keepsOnly: input.mealType === 'PREP'
		});
	}

	async setSlot(actor: Actor, timeZone: string, input: SlotInput): Promise<PlanResult> {
		const meal = await this.planService.setSlot(actor, input, timeZone);
		return { message: setSlotMessage(meal.mealName, input.day) };
	}

	async removeSlot(actor: Actor, plannedMealId: string): Promise<PlanResult> {
		const meal = await this.planService.removeSlot(actor, plannedMealId);
		return { message: `${meal.mealName} is off the plan.` };
	}

	async cookForTwoDays(actor: Actor, timeZone: string, plannedMealId: string): Promise<PlanResult> {
		const result = await this.planService.cookForTwoDays(actor, plannedMealId, timeZone);
		return {
			message: result.on ? twoDaysMessage(result.title, result.lunchDay) : JUST_TONIGHT_MESSAGE
		};
	}

	/** Plans the prep; without picks it takes the two best dishes that keep. */
	async planBatchPrep(
		actor: Actor,
		now: Date,
		timeZone: string,
		input: BatchPrepInput
	): Promise<PlanResult> {
		let recipeIds = input.recipeIds ?? [];
		if (recipeIds.length === 0) {
			const load = await this.load(actor, now, timeZone);
			const keeps = await this.planService.ideasFor(actor, load.ctx, {
				limit: PREP_DISHES,
				keepsOnly: true
			});
			const ideas =
				keeps.length >= PREP_DISHES
					? keeps
					: await this.planService.ideasFor(actor, load.ctx, { limit: PREP_DISHES });
			recipeIds = ideas.map((idea) => idea.recipeId);
		}
		if (recipeIds.length === 0) return { message: NO_RECIPES_MESSAGE };
		const result = await this.planService.planBatchPrep(
			actor,
			input.day,
			recipeIds,
			input.lunchesPerRecipe ?? PREP_LUNCHES_PER_DISH,
			timeZone
		);
		return { message: batchPrepMessage(result.lunches.length, weekdayOfDay(input.day)) };
	}

	/** Puts a new recipe on the first free dinner of the stretch. */
	async discover(
		actor: Actor,
		now: Date,
		timeZone: string,
		recipeId: string,
		range?: PlanRange
	): Promise<DiscoverResult> {
		const load = await this.load(actor, now, timeZone, range);
		const gap = await this.planService.firstGap(actor.householdId, load.stretch, timeZone);
		if (!gap) return { message: 'Every dinner in these days is planned.', planned: false };
		const meal = await this.planService.setSlot(
			actor,
			{ day: gap.day, mealType: 'DINNER', recipeId },
			timeZone
		);
		return { message: discoverMessage(meal.mealName, gap.day), planned: true };
	}

	/** "Done, boxes in the fridge": records each prep meal of the day as cooked. */
	async markPrepDone(actor: Actor, now: Date, timeZone: string, day: number): Promise<PlanResult> {
		const meals = await this.planService.listMeals(actor.householdId, day, day, timeZone);
		for (const meal of meals.filter((m) => m.isPrep && m.status === 'PLANNED' && m.recipeId)) {
			await this.kitchenService.recordCooked({
				actor,
				plannedMealId: meal.id,
				recipeId: meal.recipeId as string,
				servings: 0,
				extraPortions: meal.extraPortions,
				at: now
			});
		}
		return { message: PREP_DONE_MESSAGE };
	}

	/** Recipes planned in the stretch, for adding them to the shopping list. */
	async recipeIdsInStretch(
		actor: Actor,
		now: Date,
		timeZone: string,
		range?: PlanRange
	): Promise<string[]> {
		const load = await this.load(actor, now, timeZone, range);
		const data = await this.planService.getPlan(actor.householdId, load.stretch, now, timeZone);
		return data.recipes.map((recipe) => recipe.id);
	}

	private fillMessage(filled: number, open: number): string {
		if (filled > 0) return FILLED_MESSAGE;
		return open > 0 ? NO_RECIPES_MESSAGE : NOTHING_TO_FILL_MESSAGE;
	}

	private async load(
		actor: Actor,
		now: Date,
		timeZone: string,
		range?: PlanRange
	): Promise<PlanLoad> {
		const today = dayNumber(now, timeZone);
		const [habits, picture, calories] = await Promise.all([
			this.habitService.getHabits(actor.householdId, now, timeZone),
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.nutritionService.getCaloriesToday(actor, now, timeZone)
		]);
		return {
			today,
			habits,
			picture,
			stretch: range ? pickedStretch(range, today) : defaultStretch(habits, now, timeZone),
			ctx: {
				now,
				timeZone,
				stock: withPerishable(picture.stock, picture.lots, today),
				tracksKitchen: picture.tracks,
				slots: slotTypesFor(habits),
				calorieTarget: calories.goal ? Math.round(calories.goal * DINNER_SHARE) : null
			}
		};
	}

	/**
	 * Ingredients each planned meal will be short of, walking the meals in order, named as the
	 * meal's recipe names them.
	 */
	private forecast(
		load: PlanLoad,
		meals: PlannedMealDao[],
		recipes: RecipeWithIngredientsDao[],
		timeZone: string
	): Map<string, string[]> {
		const missing = new Map<string, string[]>();
		if (!load.picture.tracks) return missing;
		const stockKeys = load.picture.stock.map((item) => item.itemKey);
		const needs: MealNeed[] = [];
		for (const meal of meals) {
			const recipe = recipes.find((r) => r.id === meal.recipeId);
			if (!recipe || meal.status !== 'PLANNED' || meal.leftoverOfId) continue;
			const portions = (meal.servings ?? recipe.servings) + meal.extraPortions;
			const factor = portions / (recipe.servings || 1);
			needs.push({
				id: meal.id,
				day: dayNumber(meal.plannedDate, timeZone),
				portions: meal.extraPortions,
				ingredients: recipe.ingredients
					.filter((ingredient) => !ingredient.optional)
					.map((ingredient) => {
						const key = normalizeItemKey(ingredient.name);
						return {
							itemKey: stockKeys.find((stockKey) => sameItem(stockKey, key)) ?? key,
							quantity: (parseFloat(ingredient.quantity) || 0) * factor,
							unit: ingredient.unit
						};
					})
			});
		}
		const ingredientsOf = (mealId: string) =>
			recipes.find((r) => r.id === meals.find((meal) => meal.id === mealId)?.recipeId)
				?.ingredients ?? [];
		for (const result of forecastMeals(
			load.picture.lots,
			needs,
			load.today,
			load.today + STRIP_DAYS
		)) {
			missing.set(
				result.meal.id,
				result.missing.map((item) => spokenName(item.itemKey, ingredientsOf(result.meal.id)))
			);
		}
		return missing;
	}
}
