import type { Habits, Weekday } from '$lib/models/kitchen';
import {
	STRIP_DAYS,
	type PlanIdea,
	type PlannedMealRecord,
	type PlanRecipeInfo,
	type PlanSlot,
	type PlanSlotMeal,
	type PlanSlotType,
	type PlanStretch,
	type PlanStripDay,
	type PlanView,
	type PrepView
} from '$lib/models/plan';
import { greetingFor } from '../doors/greeting';
import { dayNumber, localHour, weekdayOfDay } from '../kitchen/days';
import { firstName } from '../tonight/copy';
import { fillLabel, PLAN_QUESTION, stretchLine } from './copy';
import { findGaps } from './gaps';
import { keepsWell } from './keepsWell';
import { mergePrepSteps, PREP_EXTRA_MINUTES } from './prepSteps';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A warm hue from the title, so the same dish keeps the same colour everywhere. */
export function dishHue(title: string): number {
	return [...title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7) % 50;
}

/** Day of the month of a local day number. */
export function dayOfMonth(day: number): number {
	return new Date(day * DAY_MS).getUTCDate();
}

/** Households that prep plan their lunches too. */
export function slotTypesFor(habits: Habits): PlanSlotType[] {
	return habits.prepDay !== null || habits.planningStyle === 'prep'
		? ['LUNCH', 'DINNER']
		: ['DINNER'];
}

/** The first day from `today` on `weekday`. */
export function nextWeekday(today: number, weekday: Weekday): number {
	return today + ((weekday - weekdayOfDay(today) + 7) % 7);
}

export interface PlanViewInput {
	now: Date;
	timeZone: string;
	displayName: string;
	habits: Habits;
	stretch: PlanStretch;
	/** Planned meals over the day strip. */
	meals: PlannedMealRecord[];
	recipes: PlanRecipeInfo[];
	/** Recipes the household has cooked before. */
	cookedRecipeIds: string[];
	/** Ingredient keys each planned meal still needs, by planned meal id. */
	missingByMeal: Map<string, string[]>;
	discover: PlanIdea[];
}

function prepView(
	input: PlanViewInput,
	today: number,
	recipeOf: (id: string | null) => PlanRecipeInfo | undefined
): PrepView | null {
	const { meals, timeZone } = input;
	const dayOf = (meal: PlannedMealRecord) => dayNumber(meal.plannedDate, timeZone);
	const upcoming = meals.filter((meal) => meal.isPrep && dayOf(meal) >= today);
	if (upcoming.length === 0) return null;
	const day = Math.min(...upcoming.map(dayOf));
	const prep = upcoming.filter((meal) => dayOf(meal) === day);
	const prepIds = new Set(prep.map((meal) => meal.id));
	const lunches = meals
		.filter((meal) => meal.leftoverOfId !== null && prepIds.has(meal.leftoverOfId))
		.sort((a, b) => a.plannedDate.getTime() - b.plannedDate.getTime());

	const boxCalories = lunches
		.map((meal) => recipeOf(meal.recipeId)?.calories ?? null)
		.filter((calories): calories is number => calories !== null);
	const minutes = prep
		.map((meal) => recipeOf(meal.recipeId)?.minutes ?? null)
		.filter((m): m is number => m !== null);
	const lastLunch = lunches.at(-1);

	return {
		day,
		weekday: weekdayOfDay(day),
		meals: prep.map((meal) => {
			const recipe = recipeOf(meal.recipeId);
			return {
				plannedMealId: meal.id,
				recipeId: meal.recipeId,
				title: recipe?.title ?? meal.mealName,
				imageUrl: recipe?.imageUrl ?? null,
				boxes: meal.extraPortions,
				calories: recipe?.calories ?? null,
				missing: input.missingByMeal.get(meal.id) ?? []
			};
		}),
		boxes: lunches.map((meal) => ({
			day: dayOf(meal),
			weekday: weekdayOfDay(dayOf(meal)),
			hue: dishHue(meal.mealName)
		})),
		done: prep.every((meal) => meal.status === 'COOKED'),
		caloriesPerBox: boxCalories.length
			? Math.round(boxCalories.reduce((a, b) => a + b, 0) / boxCalories.length)
			: null,
		minutes: minutes.length ? Math.max(...minutes) + PREP_EXTRA_MINUTES : null,
		steps: mergePrepSteps(
			prep.map((meal) => ({
				title: recipeOf(meal.recipeId)?.title ?? meal.mealName,
				steps: recipeOf(meal.recipeId)?.steps ?? []
			}))
		),
		lastLunchWeekday: lastLunch ? weekdayOfDay(dayOf(lastLunch)) : null
	};
}

/** Shapes the plan, the stretch and the household's habits into what the Plan door shows. */
export function buildPlanView(input: PlanViewInput): PlanView {
	const { habits, stretch, timeZone } = input;
	const today = dayNumber(input.now, timeZone);
	const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
	const recipeOf = (id: string | null) => (id ? recipes.get(id) : undefined);
	const cooked = new Set(input.cookedRecipeIds);
	const dayOf = (meal: PlannedMealRecord) => dayNumber(meal.plannedDate, timeZone);
	const live = input.meals.filter((meal) => meal.status !== 'SKIPPED' && !meal.isPrep);
	const slotTypes = slotTypesFor(habits);
	const shopWeekdays = new Set(habits.shopDays.map((shop) => shop.weekday));

	const days: PlanStripDay[] = Array.from({ length: STRIP_DAYS }, (_, i) => {
		const day = today + i;
		const dinner = live.find((meal) => meal.mealType === 'DINNER' && dayOf(meal) === day);
		return {
			day,
			weekday: weekdayOfDay(day),
			date: dayOfMonth(day),
			dish: dinner ? { name: dinner.mealName, hue: dishHue(dinner.mealName) } : null,
			shopDay: shopWeekdays.has(weekdayOfDay(day))
		};
	});

	const slotMeal = (meal: PlannedMealRecord): PlanSlotMeal => {
		const recipe = recipeOf(meal.recipeId);
		const title = recipe?.title ?? meal.mealName;
		return {
			plannedMealId: meal.id,
			recipeId: meal.recipeId,
			title,
			imageUrl: recipe?.imageUrl ?? null,
			fromThePot: meal.leftoverOfId !== null,
			withLunch: meal.extraPortions > 0,
			servings:
				meal.servings !== null && recipe && meal.servings !== recipe.servings
					? meal.servings
					: null,
			isNew: meal.recipeId !== null && !cooked.has(meal.recipeId),
			keepsWell: keepsWell({ title }),
			isPrep: false
		};
	};

	const slots: PlanSlot[] = [];
	for (let day = stretch.start; day < stretch.end; day++) {
		for (const mealType of slotTypes) {
			const meal = live.find((m) => m.mealType === mealType && dayOf(m) === day);
			slots.push({
				day,
				weekday: weekdayOfDay(day),
				date: dayOfMonth(day),
				mealType,
				meal: meal ? slotMeal(meal) : null
			});
		}
	}

	const inStretch = live.filter(
		(meal) => dayOf(meal) >= stretch.start && dayOf(meal) < stretch.end
	);
	const toBuy = new Set(inStretch.flatMap((meal) => input.missingByMeal.get(meal.id) ?? []));
	const plansFromToday = input.meals.some((meal) => dayOf(meal) >= today);

	return {
		greeting: greetingFor(Math.floor(localHour(input.now, timeZone)), firstName(input.displayName)),
		question: PLAN_QUESTION,
		today,
		style: habits.planningStyle,
		prepDay: habits.prepDay,
		nextPrepDay: habits.prepDay !== null ? nextWeekday(today, habits.prepDay) : null,
		days,
		stretch,
		stretchLine: stretchLine(stretch),
		slotTypes,
		slots,
		gaps: findGaps(live, stretch, slotTypes, timeZone),
		fillLabel: fillLabel(habits.planningStyle),
		discover: input.discover,
		prep: prepView(input, today, recipeOf),
		toBuy: toBuy.size,
		slim: habits.planningStyle === 'none' && !plansFromToday
	};
}
