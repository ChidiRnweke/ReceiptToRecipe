import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

type RecipeCalorieEstimate = {
	recipeId: string;
	title: string;
	calories: number;
	servings: number;
};

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number): number {
	const parsed = Number(value?.toString() ?? fallback);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.round(parsed));
}

/** Midnight local-time for a Date */
function startOfDay(input: Date): Date {
	const date = new Date(input);
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfDay(input: Date): Date {
	const date = new Date(input);
	date.setHours(23, 59, 59, 999);
	return date;
}

function startOfWeek(input: Date): Date {
	const date = startOfDay(input);
	const day = date.getDay();
	const diffToMonday = (day + 6) % 7;
	date.setDate(date.getDate() - diffToMonday);
	return date;
}

function endOfPlanningWindow(start: Date, days: number): Date {
	const end = endOfDay(start);
	end.setDate(start.getDate() + Math.max(days - 1, 0));
	return end;
}

/** YYYY-MM-DD in local time — timezone-safe for client round-tripping */
function toDateKey(input: Date): string {
	const y = input.getFullYear();
	const m = String(input.getMonth() + 1).padStart(2, '0');
	const d = String(input.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function parseDateKey(value: FormDataEntryValue | null): Date | null {
	const raw = value?.toString() ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
	const parsed = new Date(`${raw}T00:00:00`);
	if (!Number.isFinite(parsed.getTime())) return null;
	return parsed;
}

/**
 * Return YYYY-MM-DD keys for future weekdays (Mon–Fri) within the planning
 * window, starting from today. Max 5 days.
 */
function futureWeekdayKeys(rangeStart: Date, rangeEnd: Date): string[] {
	const todayKey = toDateKey(startOfDay(new Date()));
	const keys: string[] = [];
	const cursor = new Date(rangeStart);
	while (cursor <= rangeEnd) {
		const key = toDateKey(cursor);
		const weekday = cursor.getDay(); // 0=Sun … 6=Sat
		if (key >= todayKey && weekday >= 1 && weekday <= 5) {
			keys.push(key);
		}
		cursor.setDate(cursor.getDate() + 1);
		if (keys.length >= 5) break;
	}
	return keys;
}

function estimateRecipeCalories(recipe: {
	id: string;
	title: string;
	estimatedCalories: number | null;
	servings: number;
}): RecipeCalorieEstimate {
	const calories = recipe.estimatedCalories ?? 450;
	return {
		recipeId: recipe.id,
		title: recipe.title,
		calories,
		servings: recipe.servings
	};
}

function scoreByCalories(estimate: RecipeCalorieEstimate, perMealCalorieTarget: number): number {
	return Math.abs(estimate.calories - perMealCalorieTarget);
}

function pickRecipes(
	recipes: Array<{
		id: string;
		title: string;
		estimatedCalories: number | null;
		servings: number;
	}>,
	count: number,
	calorieLimit: number
): RecipeCalorieEstimate[] {
	const perMealTarget = Math.max(1, Math.round(calorieLimit / count));
	const estimates = recipes
		.map((r) => estimateRecipeCalories(r))
		.sort((a, b) => scoreByCalories(a, perMealTarget) - scoreByCalories(b, perMealTarget));

	const chosen: RecipeCalorieEstimate[] = [];
	for (let i = 0; i < count; i++) {
		chosen.push(estimates[i % estimates.length]);
	}
	return chosen;
}

function buildSeedIngredients(pantryItems: string[], seedIndex: number): string[] {
	const fallbackSets = [
		['chicken', 'rice', 'broccoli', 'garlic', 'olive oil'],
		['pasta', 'tomato', 'onion', 'spinach', 'parmesan'],
		['salmon', 'potato', 'lemon', 'dill', 'asparagus'],
		['tofu', 'bell pepper', 'soy sauce', 'ginger', 'scallion']
	];

	if (pantryItems.length === 0)
		return fallbackSets[seedIndex % fallbackSets.length] ?? fallbackSets[0]!;

	const size = Math.min(7, Math.max(4, pantryItems.length));
	const start = (seedIndex * 3) % pantryItems.length;
	const selected: string[] = [];
	for (let i = 0; i < size; i++) {
		selected.push(pantryItems[(start + i) % pantryItems.length]!);
	}
	return selected;
}

async function ensureRecipePool(userId: string, minimumPoolSize: number) {
	const recipeController = AppFactory.getRecipeController();
	let recipes = await recipeController.getUserRecipesWithIngredients(userId, 250);

	if (recipes.length >= minimumPoolSize) return recipes;

	const pantryController = AppFactory.getPantryController();
	const pantry = await pantryController.getUserPantry(userId);
	const pantryNames = pantry
		.map((p) => p.itemName)
		.filter(Boolean)
		.slice(0, 24);

	const missing = minimumPoolSize - recipes.length;
	const maxNewRecipes = Math.min(4, Math.max(1, missing));

	for (let i = 0; i < maxNewRecipes; i++) {
		const customIngredients = buildSeedIngredients(pantryNames, i);
		try {
			await recipeController.generateRecipe({
				userId,
				customIngredients,
				servings: 2,
				useRag: true,
				cuisineHint: i % 2 === 0 ? 'quick weeknight' : 'balanced'
			});
		} catch {
			// Best-effort top-up; continue with what we can generate.
		}
	}

	recipes = await recipeController.getUserRecipesWithIngredients(userId, 250);
	return recipes;
}

async function getPlanningData(userId: string) {
	const plannedMealRepo = AppFactory.getPlannedMealRepository();
	const recipeRepo = AppFactory.getRecipeRepository();

	const rangeStart = startOfWeek(new Date());
	const rangeEnd = endOfPlanningWindow(rangeStart, 14);

	const plannedMeals = await plannedMealRepo.findByUserIdAndRange(userId, rangeStart, rangeEnd);
	const recipeIds = [
		...new Set(plannedMeals.map((meal) => meal.recipeId).filter((id): id is string => !!id))
	];

	const recipeMap = new Map<
		string,
		Awaited<ReturnType<typeof recipeRepo.findByIdWithIngredients>>
	>();
	for (const recipeId of recipeIds) {
		const recipe = await recipeRepo.findByIdWithIngredients(recipeId);
		recipeMap.set(recipeId, recipe);
	}

	const mealsWithRecipe = plannedMeals.map((meal) => {
		const recipe = meal.recipeId ? recipeMap.get(meal.recipeId) : null;
		const calorieEstimate = recipe
			? estimateRecipeCalories({
					id: recipe.id,
					title: recipe.title,
					estimatedCalories: recipe.estimatedCalories,
					servings: recipe.servings
				})
			: null;

		return {
			id: meal.id,
			mealName: meal.mealName,
			mealType: meal.mealType,
			// Send as YYYY-MM-DD string so the client never does timezone math
			plannedDate: toDateKey(meal.plannedDate),
			recipeTitle: recipe?.title ?? meal.mealName,
			recipeImageUrl: recipe?.imageUrl ?? null,
			recipeImageStatus: recipe?.imageStatus ?? null,
			calories: calorieEstimate?.calories ?? meal.plannedCalories ?? null
		};
	});

	return {
		plannedMeals: mealsWithRecipe,
		rangeStart: rangeStart.toISOString(),
		rangeEnd: rangeEnd.toISOString()
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	return getPlanningData(locals.user.id);
};

export const actions: Actions = {
	generatePlan: async ({ locals, request }) => {
		if (!locals.user) throw redirect(302, '/login');

		const formData = await request.formData();
		const calorieLimit = parsePositiveInt(formData.get('calorieLimit'), 2000);
		const plannedMealRepo = AppFactory.getPlannedMealRepository();

		const rangeStart = startOfWeek(new Date());
		const rangeEnd = endOfPlanningWindow(rangeStart, 14);
		const weekdayKeys = futureWeekdayKeys(rangeStart, rangeEnd);

		if (weekdayKeys.length === 0) {
			return fail(400, { error: 'No upcoming weekdays left in this window.' });
		}

		const totalMeals = weekdayKeys.length * 3;
		const recipes = await ensureRecipePool(locals.user.id, Math.min(totalMeals, 10));
		if (recipes.length === 0) {
			return fail(400, {
				error: 'Could not generate a recipe pool yet. Add pantry items or try again.'
			});
		}

		const chosen = pickRecipes(recipes, totalMeals, calorieLimit);

		// Clear old plan for the full window, then fill only visible days
		await plannedMealRepo.deleteByUserIdAndRange(locals.user.id, rangeStart, rangeEnd);

		const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;
		let idx = 0;
		for (const dayKey of weekdayKeys) {
			const date = new Date(`${dayKey}T12:00:00`); // noon avoids any edge-of-day drift
			for (const mealType of mealTypes) {
				const selected = chosen[idx % chosen.length];
				await plannedMealRepo.create({
					userId: locals.user.id,
					recipeId: selected.recipeId,
					mealName: selected.title,
					plannedDate: date,
					plannedCalories: selected.calories,
					mealType
				});
				idx++;
			}
		}

		return { success: true, generatedCount: idx };
	},

	generateForDay: async ({ locals, request }) => {
		if (!locals.user) throw redirect(302, '/login');

		const formData = await request.formData();
		const day = parseDateKey(formData.get('plannedDate'));
		if (!day) return fail(400, { error: 'Invalid day selected.' });

		const today = startOfDay(new Date());
		if (day < today) {
			return fail(400, { error: 'You can only create plans for today or future days.' });
		}

		const calorieLimit = parsePositiveInt(formData.get('calorieLimit'), 2000);
		const plannedMealRepo = AppFactory.getPlannedMealRepository();
		const recipes = await ensureRecipePool(locals.user.id, 3);
		if (recipes.length === 0) {
			return fail(400, {
				error: 'Could not generate recipes for this day yet. Add pantry items or try again.'
			});
		}

		const chosen = pickRecipes(recipes, 3, calorieLimit);

		// Clear existing meals for this single day
		await plannedMealRepo.deleteByUserIdAndRange(locals.user.id, startOfDay(day), endOfDay(day));

		// Store at noon to avoid any midnight timezone drift when read back
		const noonDate = new Date(day);
		noonDate.setHours(12, 0, 0, 0);

		const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;
		for (let i = 0; i < 3; i++) {
			const selected = chosen[i];
			await plannedMealRepo.create({
				userId: locals.user.id,
				recipeId: selected.recipeId,
				mealName: selected.title,
				plannedDate: noonDate,
				plannedCalories: selected.calories,
				mealType: mealTypes[i]
			});
		}

		return { success: true, generatedCount: 3, plannedDate: toDateKey(day) };
	},

	addPlanToShopping: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const plannedMealRepo = AppFactory.getPlannedMealRepository();
		const shoppingListController = AppFactory.getShoppingListController();
		const rangeStart = startOfWeek(new Date());
		const rangeEnd = endOfPlanningWindow(rangeStart, 14);
		const plannedMeals = await plannedMealRepo.findByUserIdAndRange(
			locals.user.id,
			rangeStart,
			rangeEnd
		);

		const recipeIds = [
			...new Set(plannedMeals.map((meal) => meal.recipeId).filter((id): id is string => !!id))
		];
		if (recipeIds.length === 0) {
			return fail(400, { error: 'No planned recipes to add yet.' });
		}

		const activeList = await shoppingListController.getActiveList(locals.user.id);
		let addedItems = 0;
		for (const recipeId of recipeIds) {
			const added = await shoppingListController.addRecipeIngredients(
				locals.user.id,
				activeList.id,
				recipeId,
				false,
				[]
			);
			addedItems += added.length;
		}

		return { success: true, addedItems, recipeCount: recipeIds.length };
	},

	clearPlan: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');

		const plannedMealRepo = AppFactory.getPlannedMealRepository();
		const rangeStart = startOfWeek(new Date());
		const rangeEnd = endOfPlanningWindow(rangeStart, 14);
		await plannedMealRepo.deleteByUserIdAndRange(locals.user.id, rangeStart, rangeEnd);

		return { success: true };
	}
};
