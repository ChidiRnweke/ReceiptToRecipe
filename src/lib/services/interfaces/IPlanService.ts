import type { PlannedMealDao, RecipeDao, RecipeWithIngredientsDao } from '$repositories';
import type { Actor } from '$lib/models/household';
import type {
	MealType,
	MoveResult,
	PlanGap,
	PlanIdea,
	PlanRange,
	PlanSlotType
} from '$lib/models/plan';
import type { PlannedMealStatus } from '$lib/models/kitchen';
import type { RankStock } from '../tonight/items';
import type { CompatibilityResult } from './ITasteProfileService';

/** Checks a recipe against one person's allergies and diet; the taste profile service does. */
export interface RecipeCompatibility {
	checkRecipeCompatibility(userId: string, recipeId: string): Promise<CompatibilityResult>;
}

/** Makes a new household recipe from a few ingredients; recipe generation does. */
export interface RecipeMaker {
	makeRecipe(actor: Actor, ingredients: string[], hint: string): Promise<void>;
}

/** What the plan rules read about the moment and the kitchen. */
export interface PlanContext {
	now: Date;
	timeZone: string;
	/** The kitchen's stock, with which items are perishable. */
	stock: RankStock[];
	tracksKitchen: boolean;
	/** Slots the household plans: dinner, plus lunch when it preps. */
	slots: PlanSlotType[];
	/** Calories one dinner should come close to, or null. */
	calorieTarget: number | null;
}

/** The plan over a range, with the recipes it uses. */
export interface PlanData {
	meals: PlannedMealDao[];
	recipes: RecipeWithIngredientsDao[];
	/** Recipes the household has cooked before. */
	cookedRecipeIds: string[];
}

export interface FillResult {
	/** Slots that got a recipe. */
	filled: number;
	/** Gaps that stayed open because no recipe was left that suits everyone. */
	open: number;
	/** Recipes that could not be made to top up a small cookbook. */
	makeFailures: number;
}

export interface SetSlotInput {
	day: number;
	mealType: PlanSlotType | 'PREP';
	recipeId: string;
	/** The planned meal to swap; otherwise the meal already in the slot, or a new one. */
	replaceId?: string;
}

export interface TwoDaysResult {
	/** True when the meal now makes the next day's lunch. */
	on: boolean;
	title: string;
	lunchDay: number;
}

export interface BatchPrepResult {
	prepMeals: PlannedMealDao[];
	lunches: PlannedMealDao[];
}

export interface IdeaOptions {
	limit: number;
	/** Recipe ids never offered. */
	exclude?: string[];
	/** Only recipes that keep, for lunches from a pot. */
	keepsOnly?: boolean;
	/** Only recipes the household has not cooked. */
	freshOnly?: boolean;
}

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
	/** The plan over `range` (end exclusive), with its recipes and what was cooked before. */
	getPlan(householdId: string, range: PlanRange, now: Date, timeZone: string): Promise<PlanData>;
	/**
	 * Fills the open slots in the range with ranked recipes that suit every member of the
	 * household. A small cookbook is topped up with made-up recipes first.
	 */
	suggestRest(actor: Actor, range: PlanRange, ctx: PlanContext): Promise<FillResult>;
	/** Fills the seven days from the range's start. */
	planWholeWeek(actor: Actor, range: PlanRange, ctx: PlanContext): Promise<FillResult>;
	/** Puts a recipe in a slot, swapping the meal there; a swapped pot's leftovers follow. */
	setSlot(actor: Actor, input: SetSlotInput, timeZone: string): Promise<PlannedMealDao>;
	/** Takes a meal and its leftovers off the plan. */
	removeSlot(actor: Actor, plannedMealId: string): Promise<PlannedMealDao>;
	/** Toggles cooking a meal for two days: one extra portion and the next day's lunch. */
	cookForTwoDays(actor: Actor, plannedMealId: string, timeZone: string): Promise<TwoDaysResult>;
	/**
	 * One prep session per recipe on `day`, each cooking `lunchesPerRecipe` boxes that become
	 * the lunches of the following days without a lunch.
	 */
	planBatchPrep(
		actor: Actor,
		day: number,
		recipeIds: string[],
		lunchesPerRecipe: number,
		timeZone: string
	): Promise<BatchPrepResult>;
	/** Ranked recipes for a slot that suit every member. */
	ideasFor(actor: Actor, ctx: PlanContext, options: IdeaOptions): Promise<PlanIdea[]>;
	/** Recipes the household has not cooked and has not planned yet, ranked, never-planned first. */
	discoverNew(actor: Actor, n: number, ctx: PlanContext): Promise<PlanIdea[]>;
	/** The first day in the range without a dinner, or null. */
	firstGap(householdId: string, range: PlanRange, timeZone: string): Promise<PlanGap | null>;
}
