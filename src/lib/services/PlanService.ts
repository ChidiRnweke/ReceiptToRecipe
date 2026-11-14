import type {
	IKitchenEventRepository,
	IPlannedMealRepository,
	IRecipeIngredientRepository,
	IRecipeRepository,
	ISavedRecipeRepository,
	PlannedMealDao
} from '$repositories';
import type { Actor } from '$lib/models/household';
import { normalizeItemKey } from '$lib/models/kitchen';
import { MOVE_MAX_DAYS, PLANNED_MEAL_HOUR, type MealType, type MoveResult } from '$lib/models/plan';
import type {
	Cookbook,
	IPlanService,
	MoveOptions,
	PlannedMealWithRecipe
} from './interfaces/IPlanService';
import { atLocalHour, dayNumber, pictureEvents, projectKitchen } from './kitchen';
import { nextFreeDinnerDay } from './plan';
import { sameItem } from './tonight/items';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Meals cooked in this window count as "cooked before" for ideas. */
const COOKED_LOOKBACK_DAYS = 90;
/** How far back the kitchen picture looks, as in KitchenService. */
const PICTURE_LOOKBACK_DAYS = 730;
/** The most recipes considered for ideas. */
const COOKBOOK_LIMIT = 200;

export class PlanService implements IPlanService {
	constructor(
		private plannedMealRepository: IPlannedMealRepository,
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private savedRecipeRepository: ISavedRecipeRepository,
		private kitchenEventRepository: IKitchenEventRepository
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
