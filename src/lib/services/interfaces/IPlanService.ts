import type { PlannedMealDao, RecipeDao, RecipeWithIngredientsDao } from '$repositories';
import type { Actor } from '$lib/models/household';
import type { MealType, MoveResult } from '$lib/models/plan';
import type { PlannedMealStatus } from '$lib/models/kitchen';

/** The household's recipes, and which of them this member cooked or saved. */
export interface Cookbook {
	recipes: RecipeWithIngredientsDao[];
	/** Recipe ids the household cooked recently or the member saved. */
	cookedOrSaved: string[];
}

export interface PlannedMealWithRecipe {
	meal: PlannedMealDao;
	recipe: RecipeDao | null;
}

export interface MoveOptions {
	/** The status a meal gets when no day is free. Defaults to SKIPPED. */
	ifNoDay?: Extract<PlannedMealStatus, 'SKIPPED' | 'EATEN_OUT'>;
}

export interface IPlanService {
	/** Planned meals on the local days `fromDay`…`toDay`, inclusive. */
	listMeals(
		householdId: string,
		fromDay: number,
		toDay: number,
		timeZone: string
	): Promise<PlannedMealDao[]>;
	/** A planned meal of the household and its recipe; throws when it is not the household's. */
	getMeal(householdId: string, plannedMealId: string): Promise<PlannedMealWithRecipe>;
	getCookbook(actor: Actor, now: Date): Promise<Cookbook>;
	/** Puts a household recipe on a local day. */
	planMeal(
		actor: Actor,
		recipeId: string,
		day: number,
		mealType: MealType,
		timeZone: string
	): Promise<PlannedMealDao>;
	/**
	 * Moves a meal to the first later day without a dinner, at most three days on and never past
	 * the expiry of the first of its perishable ingredients in the kitchen. With no free day the
	 * meal leaves the plan (SKIPPED, or the status in `options`).
	 */
	moveToNextFreeDay(
		householdId: string,
		plannedMealId: string,
		now: Date,
		timeZone: string,
		options?: MoveOptions
	): Promise<MoveResult>;
}
