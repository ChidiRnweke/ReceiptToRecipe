import type {
	IHouseholdRepository,
	IKitchenEventRepository,
	IPlannedMealRepository,
	IRecipeIngredientRepository,
	IRecipeRepository,
	ISavedRecipeRepository,
	PlannedMealDao,
	RecipeDao,
	RecipeWithIngredientsDao
} from '$repositories';
import type { Actor } from '$lib/models/household';
import { normalizeItemKey } from './kitchen/itemKey';
import {
	MOVE_MAX_DAYS,
	PLANNED_MEAL_HOUR,
	type MealType,
	type MoveResult,
	type PlanGap,
	type PlanIdea,
	type PlanRange,
	type PlanRecipe
} from '$lib/models/plan';
import type { CompatibilityResult } from './interfaces/ITasteProfileService';
import type {
	BatchPrepResult,
	Cookbook,
	FillResult,
	IdeaOptions,
	IPlanService,
	MoveOptions,
	PlanContext,
	PlanData,
	PlannedMealWithRecipe,
	RecipeCompatibility,
	RecipeMaker,
	SetSlotInput,
	TwoDaysResult
} from './interfaces/IPlanService';
import { atLocalHour, dayNumber, pictureEvents, projectKitchen } from './kitchen';
import {
	findGaps,
	keepsWell,
	nextFreeDinnerDay,
	pickForGaps,
	planLeftoverLunch,
	WEEK_DAYS
} from './plan';
import { rankIdeas } from './tonight/rankIdeas';
import { sameItem } from './tonight/items';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Meals cooked in this window count as "cooked before" for ideas. */
const COOKED_LOOKBACK_DAYS = 90;
/** How far back the kitchen picture looks, as in KitchenService. */
const PICTURE_LOOKBACK_DAYS = 730;
/** The most recipes considered for ideas. */
const COOKBOOK_LIMIT = 200;
/** Filling the plan tops a cookbook smaller than this up with made-up recipes. */
const POOL_MIN = 10;
/** The most recipes made up in one go. */
const POOL_TOP_UP_MAX = 4;
/** Fallback ingredient sets when the kitchen is empty. */
const SEED_SETS = [
	['chicken', 'rice', 'broccoli', 'garlic', 'olive oil'],
	['pasta', 'tomato', 'onion', 'spinach', 'parmesan'],
	['salmon', 'potato', 'lemon', 'dill', 'asparagus'],
	['tofu', 'bell pepper', 'soy sauce', 'ginger', 'scallion']
];

/** Diet clashes are warnings in a compatibility result; for planning they block like allergies. */
function blocksPlanning(result: CompatibilityResult): boolean {
	return !result.compatible || result.warnings.some((warning) => warning.startsWith('May not be'));
}

/** A few ingredients to make a recipe from: a slice of the kitchen, or a fallback set. */
function seedIngredients(stockNames: string[], index: number): string[] {
	if (stockNames.length === 0) return SEED_SETS[index % SEED_SETS.length];
	const size = Math.min(7, Math.max(4, stockNames.length));
	const start = (index * 3) % stockNames.length;
	return Array.from({ length: size }, (_, i) => stockNames[(start + i) % stockNames.length]);
}

/** A household recipe as the ranking reads it, named as the kitchen names its items. */
interface RankRecipe extends PlanRecipe {
	source: RecipeWithIngredientsDao;
}

function toRankRecipe(recipe: RecipeWithIngredientsDao, stockKeys: string[]): RankRecipe {
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

function minutesOf(recipe: RecipeWithIngredientsDao): number | null {
	if (recipe.prepTime === null && recipe.cookTime === null) return null;
	return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

export class PlanService implements IPlanService {
	constructor(
		private plannedMealRepository: IPlannedMealRepository,
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private savedRecipeRepository: ISavedRecipeRepository,
		private kitchenEventRepository: IKitchenEventRepository,
		private householdRepository: IHouseholdRepository,
		private compatibility: RecipeCompatibility,
		private recipeMaker: RecipeMaker | null = null
	) {}

	async listMeals(
		householdId: string,
		fromDay: number,
		toDay: number,
		timeZone: string
	): Promise<PlannedMealDao[]> {
		const start = atLocalHour(fromDay, 0, timeZone);
		const end = new Date(atLocalHour(toDay + 1, 0, timeZone).getTime() - 1);
		const meals = await this.plannedMealRepository.findByHouseholdIdAndRange(
			householdId,
			start,
			end
		);
		return meals
			.filter((meal) => {
				const day = dayNumber(meal.plannedDate, timeZone);
				return day >= fromDay && day <= toDay;
			})
			.sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime());
	}

	async getMeal(householdId: string, plannedMealId: string): Promise<PlannedMealWithRecipe> {
		const meal = await this.plannedMealRepository.findById(plannedMealId);
		if (!meal || meal.householdId !== householdId) throw new Error('Planned meal not found');
		const recipe = meal.recipeId ? await this.recipeRepository.findById(meal.recipeId) : null;
		return { meal, recipe };
	}

	async getCookbook(actor: Actor, now: Date): Promise<Cookbook> {
		const since = new Date(now.getTime() - COOKED_LOOKBACK_DAYS * DAY_MS);
		const [recipes, saved, recent] = await Promise.all([
			this.recipeRepository.findByHouseholdIdWithIngredients(actor.householdId, COOKBOOK_LIMIT),
			this.savedRecipeRepository.findByUserId(actor.userId),
			this.plannedMealRepository.findByHouseholdIdAndRange(actor.householdId, since, now)
		]);
		const cooked = recent
			.filter((meal) => meal.status === 'COOKED' && meal.recipeId)
			.map((meal) => meal.recipeId as string);
		return {
			recipes,
			cookedOrSaved: [...new Set([...cooked, ...saved.map((s) => s.recipeId)])]
		};
	}

	async planMeal(
		actor: Actor,
		recipeId: string,
		day: number,
		mealType: MealType,
		timeZone: string
	): Promise<PlannedMealDao> {
		const recipe = await this.recipeRepository.findById(recipeId);
		if (!recipe || recipe.householdId !== actor.householdId) throw new Error('Recipe not found');
		return this.plannedMealRepository.create({
			userId: actor.userId,
			householdId: actor.householdId,
			recipeId: recipe.id,
			mealName: recipe.title,
			plannedDate: atLocalHour(day, PLANNED_MEAL_HOUR, timeZone),
			plannedCalories: recipe.estimatedCalories ?? 0,
			mealType
		});
	}

	async moveToNextFreeDay(
		householdId: string,
		plannedMealId: string,
		now: Date,
		timeZone: string,
		options: MoveOptions = {}
	): Promise<MoveResult> {
		const { meal } = await this.getMeal(householdId, plannedMealId);
		const mealDay = dayNumber(meal.plannedDate, timeZone);
		const keptBy = await this.firstToExpire(householdId, meal, now, timeZone);

		const lastDay = Math.min(mealDay + MOVE_MAX_DAYS, keptBy?.expiresOn ?? Infinity);
		const others = (await this.listMeals(householdId, mealDay + 1, lastDay, timeZone)).filter(
			(other) => other.id !== meal.id
		);
		const free =
			lastDay > mealDay ? nextFreeDinnerDay(others, mealDay + 1, lastDay, timeZone) : null;
		const kept = keptBy
			? {
					itemKey: keptBy.itemKey,
					until: atLocalHour(keptBy.expiresOn, PLANNED_MEAL_HOUR, timeZone)
				}
			: null;

		if (free === null) {
			await this.plannedMealRepository.update(meal.id, { status: options.ifNoDay ?? 'SKIPPED' });
			return { movedTo: null, keptBy: kept };
		}
		const movedTo = atLocalHour(free, PLANNED_MEAL_HOUR, timeZone);
		await this.plannedMealRepository.update(meal.id, { plannedDate: movedTo, status: 'PLANNED' });
		return { movedTo, keptBy: kept };
	}

	async getPlan(
		householdId: string,
		range: PlanRange,
		now: Date,
		timeZone: string
	): Promise<PlanData> {
		const [meals, cookedRecipeIds] = await Promise.all([
			this.listMeals(householdId, range.start, range.end - 1, timeZone),
			this.cookedRecipeIds(householdId, now)
		]);
		const ids = [...new Set(meals.map((meal) => meal.recipeId).filter((id) => id !== null))];
		const recipes = await Promise.all(
			ids.map((id) => this.recipeRepository.findByIdWithIngredients(id))
		);
		return {
			meals,
			recipes: recipes.filter(
				(recipe): recipe is RecipeWithIngredientsDao =>
					recipe !== null && recipe.householdId === householdId
			),
			cookedRecipeIds
		};
	}

	async suggestRest(actor: Actor, range: PlanRange, ctx: PlanContext): Promise<FillResult> {
		const meals = await this.listMeals(actor.householdId, range.start, range.end - 1, ctx.timeZone);
		const gaps = findGaps(meals, range, ctx.slots, ctx.timeZone);
		if (gaps.length === 0) return { filled: 0, open: 0, makeFailures: 0 };

		const alreadyPlanned = meals
			.map((meal) => meal.recipeId)
			.filter((id): id is string => id !== null);
		const makeFailures = await this.ensureRecipePool(
			actor,
			Math.min(gaps.length + alreadyPlanned.length, POOL_MIN),
			ctx.stock.map((item) => item.itemKey)
		);
		const ranked = await this.suitableRanked(actor, ctx, {
			limit: gaps.length + alreadyPlanned.length,
			exclude: alreadyPlanned
		});
		const picks = pickForGaps(
			ranked.map((idea) => ({
				id: idea.recipe.id,
				calories: idea.recipe.source.estimatedCalories,
				uses: idea.uses,
				missing: idea.missing
			})),
			gaps,
			{ calorieTarget: ctx.calorieTarget, alreadyPlanned }
		);
		const byId = new Map(ranked.map((idea) => [idea.recipe.id, idea.recipe.source]));
		for (const pick of picks) {
			const recipe = byId.get(pick.recipeId);
			if (!recipe) continue;
			await this.createMeal(actor, recipe, pick.gap.day, pick.gap.mealType, ctx.timeZone);
		}
		return { filled: picks.length, open: gaps.length - picks.length, makeFailures };
	}

	async planWholeWeek(actor: Actor, range: PlanRange, ctx: PlanContext): Promise<FillResult> {
		return this.suggestRest(actor, { start: range.start, end: range.start + WEEK_DAYS }, ctx);
	}

	async setSlot(actor: Actor, input: SetSlotInput, timeZone: string): Promise<PlannedMealDao> {
		const recipe = await this.recipeRepository.findById(input.recipeId);
		if (!recipe || recipe.householdId !== actor.householdId) throw new Error('Recipe not found');
		const change = {
			recipeId: recipe.id,
			mealName: recipe.title,
			plannedCalories: recipe.estimatedCalories ?? 0,
			status: 'PLANNED' as const
		};

		let current: PlannedMealDao | null = null;
		if (input.replaceId) {
			current = (await this.getMeal(actor.householdId, input.replaceId)).meal;
		} else if (input.mealType !== 'PREP') {
			const onDay = await this.listMeals(actor.householdId, input.day, input.day, timeZone);
			current =
				onDay.find(
					(meal) => meal.mealType === input.mealType && meal.status !== 'SKIPPED' && !meal.isPrep
				) ?? null;
		}
		if (!current) {
			return this.createMeal(actor, recipe, input.day, input.mealType, timeZone, {
				isPrep: input.mealType === 'PREP'
			});
		}
		for (const leftover of await this.leftoversOf(actor.householdId, current, timeZone)) {
			await this.plannedMealRepository.update(leftover.id, change);
		}
		return this.plannedMealRepository.update(current.id, change);
	}

	async removeSlot(actor: Actor, plannedMealId: string): Promise<PlannedMealDao> {
		const { meal } = await this.getMeal(actor.householdId, plannedMealId);
		const day = meal.plannedDate;
		const leftovers = (
			await this.plannedMealRepository.findByHouseholdIdAndRange(
				actor.householdId,
				day,
				new Date(day.getTime() + PICTURE_LOOKBACK_DAYS * DAY_MS)
			)
		).filter((other) => other.leftoverOfId === meal.id);
		for (const leftover of leftovers) await this.plannedMealRepository.delete(leftover.id);
		await this.plannedMealRepository.delete(meal.id);
		return meal;
	}

	async cookForTwoDays(
		actor: Actor,
		plannedMealId: string,
		timeZone: string
	): Promise<TwoDaysResult> {
		const { meal } = await this.getMeal(actor.householdId, plannedMealId);
		const lunch = planLeftoverLunch(meal, timeZone);
		if (meal.extraPortions > 0) {
			for (const leftover of await this.leftoversOf(actor.householdId, meal, timeZone)) {
				await this.plannedMealRepository.delete(leftover.id);
			}
			await this.plannedMealRepository.update(meal.id, { extraPortions: 0 });
			return { on: false, title: meal.mealName, lunchDay: lunch.day };
		}

		await this.plannedMealRepository.update(meal.id, { extraPortions: 1 });
		const nextDay = await this.listMeals(actor.householdId, lunch.day, lunch.day, timeZone);
		const lunchTaken = nextDay.some(
			(other) => other.mealType === 'LUNCH' && other.status !== 'SKIPPED'
		);
		if (!lunchTaken) {
			await this.plannedMealRepository.create({
				userId: actor.userId,
				householdId: actor.householdId,
				recipeId: lunch.recipeId,
				mealName: lunch.mealName,
				plannedDate: atLocalHour(lunch.day, PLANNED_MEAL_HOUR, timeZone),
				plannedCalories: meal.plannedCalories,
				mealType: 'LUNCH',
				leftoverOfId: lunch.leftoverOfId
			});
		}
		return { on: true, title: meal.mealName, lunchDay: lunch.day };
	}

	async planBatchPrep(
		actor: Actor,
		day: number,
		recipeIds: string[],
		lunchesPerRecipe: number,
		timeZone: string
	): Promise<BatchPrepResult> {
		const recipes = await Promise.all(recipeIds.map((id) => this.recipeRepository.findById(id)));
		const own = recipes.filter(
			(recipe): recipe is RecipeDao => recipe !== null && recipe.householdId === actor.householdId
		);
		if (own.length !== recipeIds.length || own.length === 0) throw new Error('Recipe not found');

		const prepMeals: PlannedMealDao[] = [];
		for (const recipe of own) {
			prepMeals.push(
				await this.createMeal(actor, recipe, day, 'PREP', timeZone, {
					isPrep: true,
					extraPortions: lunchesPerRecipe
				})
			);
		}

		const total = own.length * lunchesPerRecipe;
		const horizon = day + total + MOVE_MAX_DAYS * 2;
		const planned = await this.listMeals(actor.householdId, day + 1, horizon, timeZone);
		const lunchDays: number[] = [];
		for (let d = day + 1; d <= horizon && lunchDays.length < total; d++) {
			const taken = planned.some(
				(meal) =>
					meal.mealType === 'LUNCH' &&
					meal.status !== 'SKIPPED' &&
					dayNumber(meal.plannedDate, timeZone) === d
			);
			if (!taken) lunchDays.push(d);
		}

		// Boxes alternate between the dishes, so no one eats the same lunch all week.
		const lunches: PlannedMealDao[] = [];
		for (const [i, lunchDay] of lunchDays.entries()) {
			const source = prepMeals[i % prepMeals.length];
			lunches.push(
				await this.plannedMealRepository.create({
					userId: actor.userId,
					householdId: actor.householdId,
					recipeId: source.recipeId,
					mealName: source.mealName,
					plannedDate: atLocalHour(lunchDay, PLANNED_MEAL_HOUR, timeZone),
					plannedCalories: source.plannedCalories,
					mealType: 'LUNCH',
					leftoverOfId: source.id
				})
			);
		}
		return { prepMeals, lunches };
	}

	async ideasFor(actor: Actor, ctx: PlanContext, options: IdeaOptions): Promise<PlanIdea[]> {
		const cooked = new Set(await this.cookedRecipeIds(actor.householdId, ctx.now));
		const ranked = await this.suitableRanked(actor, ctx, {
			limit: options.limit,
			exclude: options.exclude,
			accept: (recipe) =>
				(!options.keepsOnly || keepsWell(recipe)) && (!options.freshOnly || !cooked.has(recipe.id))
		});
		return ranked.map((idea) => this.toIdea(idea, cooked));
	}

	async discoverNew(actor: Actor, n: number, ctx: PlanContext): Promise<PlanIdea[]> {
		const since = new Date(ctx.now.getTime() - PICTURE_LOOKBACK_DAYS * DAY_MS);
		const [cooked, planned] = await Promise.all([
			this.cookedRecipeIds(actor.householdId, ctx.now),
			this.plannedMealRepository.findByHouseholdIdAndRange(
				actor.householdId,
				since,
				new Date(ctx.now.getTime() + PICTURE_LOOKBACK_DAYS * DAY_MS)
			)
		]);
		const cookedSet = new Set(cooked);
		const today = dayNumber(ctx.now, ctx.timeZone);
		const upcoming = new Set(
			planned
				.filter((meal) => dayNumber(meal.plannedDate, ctx.timeZone) >= today)
				.map((meal) => meal.recipeId)
		);
		const plannedSet = new Set(planned.map((meal) => meal.recipeId));
		const ranked = await this.suitableRanked(actor, ctx, {
			limit: Number.MAX_SAFE_INTEGER,
			accept: (recipe) => !cookedSet.has(recipe.id) && !upcoming.has(recipe.id)
		});
		// Never planned beats once planned but never cooked; the rank decides within each group.
		return ranked
			.map((idea, index) => ({ idea, index, seen: plannedSet.has(idea.recipe.id) ? 1 : 0 }))
			.sort((a, b) => a.seen - b.seen || a.index - b.index)
			.slice(0, n)
			.map(({ idea }) => this.toIdea(idea, cookedSet));
	}

	async firstGap(householdId: string, range: PlanRange, timeZone: string): Promise<PlanGap | null> {
		const meals = await this.listMeals(householdId, range.start, range.end - 1, timeZone);
		return findGaps(meals, range, ['DINNER'], timeZone)[0] ?? null;
	}

	/** Recipes the household cooked, from its COOKED events and its cooked planned meals. */
	private async cookedRecipeIds(householdId: string, now: Date): Promise<string[]> {
		const since = new Date(now.getTime() - PICTURE_LOOKBACK_DAYS * DAY_MS);
		const [events, meals] = await Promise.all([
			this.kitchenEventRepository.listByHouseholdSince(householdId, since),
			this.plannedMealRepository.findByHouseholdIdAndRange(householdId, since, now)
		]);
		const ids = [
			...events.filter((event) => event.kind === 'COOKED').map((event) => event.recipeId),
			...meals.filter((meal) => meal.status === 'COOKED').map((meal) => meal.recipeId)
		];
		return [...new Set(ids.filter((id): id is string => id !== null))];
	}

	/** Planned meals that are leftovers of `meal`, in the days after it. */
	private async leftoversOf(
		householdId: string,
		meal: PlannedMealDao,
		timeZone: string
	): Promise<PlannedMealDao[]> {
		const day = dayNumber(meal.plannedDate, timeZone);
		return (await this.listMeals(householdId, day, day + PICTURE_LOOKBACK_DAYS, timeZone)).filter(
			(other) => other.leftoverOfId === meal.id
		);
	}

	private createMeal(
		actor: Actor,
		recipe: { id: string; title: string; estimatedCalories: number | null },
		day: number,
		mealType: MealType,
		timeZone: string,
		extra: { isPrep?: boolean; extraPortions?: number } = {}
	): Promise<PlannedMealDao> {
		return this.plannedMealRepository.create({
			userId: actor.userId,
			householdId: actor.householdId,
			recipeId: recipe.id,
			mealName: recipe.title,
			plannedDate: atLocalHour(day, PLANNED_MEAL_HOUR, timeZone),
			plannedCalories: recipe.estimatedCalories ?? 0,
			mealType,
			isPrep: extra.isPrep ?? false,
			extraPortions: extra.extraPortions ?? 0
		});
	}

	/**
	 * Tops a small cookbook up with recipes made from the kitchen's items. Returns how many could
	 * not be made; the plan then fills from the recipes that exist.
	 */
	private async ensureRecipePool(
		actor: Actor,
		minimum: number,
		stockNames: string[]
	): Promise<number> {
		if (!this.recipeMaker) return 0;
		const recipes = await this.recipeRepository.findByHouseholdIdWithIngredients(
			actor.householdId,
			COOKBOOK_LIMIT
		);
		const missing = minimum - recipes.length;
		if (missing <= 0) return 0;
		let failures = 0;
		for (let i = 0; i < Math.min(POOL_TOP_UP_MAX, missing); i++) {
			const hint = i % 2 === 0 ? 'quick weeknight' : 'balanced';
			await this.recipeMaker
				.makeRecipe(actor, seedIngredients(stockNames.slice(0, 24), i), hint)
				.catch((error: unknown) => {
					failures++;
					console.error('Could not make a recipe to fill the plan', error);
				});
		}
		return failures;
	}

	/**
	 * Household recipes ranked by `rankIdeas`, keeping only those that suit every member: a
	 * severe allergy or a diet clash of anyone in the household blocks a recipe. Recipes are
	 * checked in rank order until `limit` suitable ones are found.
	 */
	private async suitableRanked(
		actor: Actor,
		ctx: PlanContext,
		options: {
			limit: number;
			exclude?: string[];
			accept?: (recipe: RecipeWithIngredientsDao) => boolean;
		}
	) {
		const today = dayNumber(ctx.now, ctx.timeZone);
		const [recipes, members, cookbook] = await Promise.all([
			this.recipeRepository.findByHouseholdIdWithIngredients(actor.householdId, COOKBOOK_LIMIT),
			this.householdRepository.listMembers(actor.householdId),
			this.getCookbook(actor, ctx.now)
		]);
		const stockKeys = ctx.stock.map((item) => item.itemKey);
		const accept = options.accept ?? (() => true);
		const rankRecipes = recipes.filter(accept).map((recipe) => toRankRecipe(recipe, stockKeys));
		const knownIds = new Set(cookbook.cookedOrSaved);
		const known = rankRecipes
			.filter((recipe) => knownIds.has(recipe.id))
			.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.itemKey));
		const ranked = rankIdeas(rankRecipes, ctx.stock, [], {
			day: today,
			tracksKitchen: ctx.tracksKitchen,
			known,
			exclude: options.exclude,
			limit: rankRecipes.length
		});

		const userIds = members.length ? members.map((member) => member.userId) : [actor.userId];
		const suitable: typeof ranked = [];
		for (const idea of ranked) {
			if (suitable.length >= options.limit) break;
			const results = await Promise.all(
				userIds.map((userId) => this.compatibility.checkRecipeCompatibility(userId, idea.recipe.id))
			);
			if (!results.some(blocksPlanning)) suitable.push(idea);
		}
		return suitable;
	}

	private toIdea(
		idea: { recipe: RankRecipe; uses: string[]; missing: string[] },
		cooked: Set<string>
	): PlanIdea {
		const source = idea.recipe.source;
		return {
			recipeId: source.id,
			title: source.title,
			imageUrl: source.imageUrl,
			minutes: minutesOf(source),
			calories: source.estimatedCalories,
			uses: idea.uses,
			missing: idea.missing,
			isNew: !cooked.has(source.id),
			keepsWell: keepsWell(source)
		};
	}

	/** The meal's perishable ingredient in the kitchen that goes off first. */
	private async firstToExpire(
		householdId: string,
		meal: PlannedMealDao,
		now: Date,
		timeZone: string
	): Promise<{ itemKey: string; expiresOn: number } | null> {
		if (!meal.recipeId) return null;
		const since = new Date(now.getTime() - PICTURE_LOOKBACK_DAYS * DAY_MS);
		const [ingredients, events] = await Promise.all([
			this.recipeIngredientRepository.findByRecipeId(meal.recipeId),
			this.kitchenEventRepository.listByHouseholdSince(householdId, since)
		]);
		const today = dayNumber(now, timeZone);
		const lots = projectKitchen(pictureEvents(events, now, timeZone), now, timeZone).filter(
			(lot) => lot.perishable && lot.expiresOn >= today && lot.quantity > 0
		);
		let first: { itemKey: string; expiresOn: number } | null = null;
		for (const ingredient of ingredients) {
			const itemKey = normalizeItemKey(ingredient.name);
			for (const lot of lots) {
				if (sameItem(lot.itemKey, itemKey) && (!first || lot.expiresOn < first.expiresOn)) {
					first = { itemKey, expiresOn: lot.expiresOn };
				}
			}
		}
		return first;
	}
}
