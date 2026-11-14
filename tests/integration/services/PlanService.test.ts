import { describe, it, expect, beforeEach } from 'vitest';
import { createPlan } from '../../fakes/plan';
import { actor, createTonight } from '../../fakes/tonight';
import { DAY0, TZ, at, bought } from '../../helpers/kitchenEvents';
import { dayNumber } from '../../../src/lib/services/kitchen';
import type { PlanContext } from '../../../src/lib/services/interfaces/IPlanService';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC. "Now" is Monday 10:00.
const NOW = at(0, 10);
const ctx: PlanContext = {
	now: NOW,
	timeZone: TZ,
	stock: [],
	tracksKitchen: false,
	slots: ['DINNER'],
	calorieTarget: null
};
const ONE_DAY = { start: DAY0, end: DAY0 + 1 };

describe('PlanService', () => {
	let p: ReturnType<typeof createPlan>;
	let curry: { id: string; title: string };
	let tacos: { id: string; title: string };

	beforeEach(async () => {
		p = createPlan();
		curry = await p.addRecipe('Chickpea curry', [{ name: 'Chickpeas', quantity: 1, unit: 'can' }]);
		tacos = await p.addRecipe('Chicken tacos', [{ name: 'Tortillas', quantity: 8, unit: '' }]);
	});

	const mealsOn = (day: number) => p.plan.listMeals(actor.householdId, day, day, TZ);

	describe('suggestRest', () => {
		it('skips a recipe that one member is severely allergic to', async () => {
			await p.addMember('user-2', 'Sam');
			p.taste.setCompatibility('user-2', curry.id, {
				compatible: false,
				warnings: [],
				blockers: ['Contains chickpeas'],
				matchScore: 0
			});
			await p.plan.suggestRest(actor, ONE_DAY, ctx);
			expect((await mealsOn(DAY0)).map((meal) => meal.recipeId)).toEqual([tacos.id]);
		});

		it('skips a recipe that clashes with a member’s diet', async () => {
			await p.addMember('user-2', 'Sam');
			p.taste.setCompatibility('user-2', tacos.id, {
				compatible: true,
				warnings: ['May not be vegetarian (contains Chicken)'],
				blockers: [],
				matchScore: 70
			});
			p.taste.setCompatibility('user-2', curry.id, {
				compatible: false,
				warnings: [],
				blockers: ['Contains chickpeas'],
				matchScore: 0
			});
			const result = await p.plan.suggestRest(actor, ONE_DAY, ctx);
			expect(result.open).toBe(1);
		});

		it('fills every open dinner of the range', async () => {
			const result = await p.plan.suggestRest(actor, { start: DAY0, end: DAY0 + 2 }, ctx);
			expect(result.filled).toBe(2);
		});

		it('asks for new recipes when the cookbook is small', async () => {
			await p.plan.suggestRest(actor, { start: DAY0, end: DAY0 + 4 }, ctx);
			expect(p.maker.made.length).toBeGreaterThan(0);
		});
	});

	describe('cookForTwoDays', () => {
		it('plans tomorrow’s lunch from the same pot', async () => {
			const dinner = await p.planOn(curry, DAY0);
			await p.plan.cookForTwoDays(actor, dinner.id, TZ);
			const lunch = (await mealsOn(DAY0 + 1)).find((meal) => meal.mealType === 'LUNCH');
			expect(lunch?.leftoverOfId).toBe(dinner.id);
		});

		it('cooks one extra portion', async () => {
			const dinner = await p.planOn(curry, DAY0);
			await p.plan.cookForTwoDays(actor, dinner.id, TZ);
			expect((await p.plannedMeals.findById(dinner.id))?.extraPortions).toBe(1);
		});

		it('takes the lunch off the plan when toggled off', async () => {
			const dinner = await p.planOn(curry, DAY0);
			await p.plan.cookForTwoDays(actor, dinner.id, TZ);
			await p.plan.cookForTwoDays(actor, dinner.id, TZ);
			expect(await mealsOn(DAY0 + 1)).toEqual([]);
		});
	});

	describe('planBatchPrep', () => {
		it('makes four lunches from two recipes with two boxes each', async () => {
			const result = await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, tacos.id], 2, TZ);
			expect(result.lunches).toHaveLength(4);
		});

		it('puts the lunches on the days after the prep', async () => {
			const result = await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, tacos.id], 2, TZ);
			expect(result.lunches.map((meal) => dayNumber(meal.plannedDate, TZ))).toEqual([
				DAY0 + 7,
				DAY0 + 8,
				DAY0 + 9,
				DAY0 + 10
			]);
		});

		it('marks each prep session as prep with its boxes', async () => {
			const result = await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, tacos.id], 2, TZ);
			expect(result.prepMeals.map((meal) => [meal.isPrep, meal.extraPortions])).toEqual([
				[true, 2],
				[true, 2]
			]);
		});

		it('links every lunch to the prep that cooks it', async () => {
			const result = await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, tacos.id], 2, TZ);
			const prepIds = new Set(result.prepMeals.map((meal) => meal.id));
			expect(result.lunches.every((meal) => prepIds.has(meal.leftoverOfId ?? ''))).toBe(true);
		});
	});

	describe('setSlot and removeSlot', () => {
		it('swaps the recipe of a filled slot instead of adding a second dinner', async () => {
			await p.planOn(curry, DAY0);
			await p.plan.setSlot(actor, { day: DAY0, mealType: 'DINNER', recipeId: tacos.id }, TZ);
			expect((await mealsOn(DAY0)).map((meal) => meal.recipeId)).toEqual([tacos.id]);
		});

		it('removes a meal together with its leftover lunch', async () => {
			const dinner = await p.planOn(curry, DAY0);
			await p.plan.cookForTwoDays(actor, dinner.id, TZ);
			await p.plan.removeSlot(actor, dinner.id);
			expect(await p.plan.listMeals(actor.householdId, DAY0, DAY0 + 1, TZ)).toEqual([]);
		});
	});

	describe('discoverNew', () => {
		it('offers only recipes the household has not cooked', async () => {
			const dinner = await p.planOn(curry, DAY0 - 3);
			await p.plannedMeals.update(dinner.id, { status: 'COOKED' });
			const ideas = await p.plan.discoverNew(actor, 5, ctx);
			expect(ideas.map((idea) => idea.recipeId)).toEqual([tacos.id]);
		});

		it('leaves out a new recipe that is already in the plan', async () => {
			await p.planOn(tacos, DAY0 + 2);
			const ideas = await p.plan.discoverNew(actor, 5, ctx);
			expect(ideas.map((idea) => idea.recipeId)).toEqual([curry.id]);
		});
	});
});

// "Now" for the Tonight door's moves is Monday 18:00.
const EVENING = at(0, 18);

describe('PlanService on the Tonight door', () => {
	let t: ReturnType<typeof createTonight>;
	let risotto: { id: string; title: string };
	let tacos: { id: string; title: string };

	beforeEach(async () => {
		t = createTonight();
		risotto = await t.addRecipe('Mushroom risotto', [
			{ name: 'Mushrooms', quantity: 250, unit: 'g' },
			{ name: 'Rice', quantity: 200, unit: 'g' }
		]);
		tacos = await t.addRecipe('Fish tacos', [{ name: 'Tortillas', quantity: 6, unit: 'count' }]);
	});

	async function move(mealId: string) {
		return t.plan.moveToNextFreeDay(actor.householdId, mealId, EVENING, TZ);
	}

	describe('moveToNextFreeDay', () => {
		it('moves the meal to tomorrow when tomorrow is free', async () => {
			const meal = await t.planOn(risotto, DAY0);
			const result = await move(meal.id);
			expect(dayNumber(result.movedTo as Date, TZ)).toBe(DAY0 + 1);
		});

		it('stores the moved meal on its new day', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await move(meal.id);
			const stored = await t.plannedMeals.findById(meal.id);
			expect(dayNumber(stored!.plannedDate, TZ)).toBe(DAY0 + 1);
		});

		it('passes over a day that already has a dinner', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await t.planOn(tacos, DAY0 + 1);
			const result = await move(meal.id);
			expect(dayNumber(result.movedTo as Date, TZ)).toBe(DAY0 + 2);
		});

		it('does not move a meal past the expiry of its perishable ingredient', async () => {
			await t.events.append(bought('mushrooms', 250, 'g', 0, { expiresInDays: 1 }));
			const meal = await t.planOn(risotto, DAY0);
			await t.planOn(tacos, DAY0 + 1);
			const result = await move(meal.id);
			expect(result.movedTo).toBeNull();
		});

		it('names the perishable that limited the move', async () => {
			await t.events.append(bought('mushrooms', 250, 'g', 0, { expiresInDays: 2 }));
			const meal = await t.planOn(risotto, DAY0);
			const result = await move(meal.id);
			expect(result.keptBy?.itemKey).toBe('mushroom');
		});

		it('skips the meal when no day in the next three is free', async () => {
			const meal = await t.planOn(risotto, DAY0);
			for (const day of [1, 2, 3]) await t.planOn(tacos, DAY0 + day);
			await move(meal.id);
			expect((await t.plannedMeals.findById(meal.id))?.status).toBe('SKIPPED');
		});

		it('marks the meal eaten out when asked and no day is free', async () => {
			const meal = await t.planOn(risotto, DAY0);
			for (const day of [1, 2, 3]) await t.planOn(tacos, DAY0 + day);
			await t.plan.moveToNextFreeDay(actor.householdId, meal.id, EVENING, TZ, {
				ifNoDay: 'EATEN_OUT'
			});
			expect((await t.plannedMeals.findById(meal.id))?.status).toBe('EATEN_OUT');
		});

		it('refuses a meal of another household', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await expect(t.plan.moveToNextFreeDay('household-2', meal.id, EVENING, TZ)).rejects.toThrow(
				'Planned meal not found'
			);
		});
	});

	describe('planMeal', () => {
		it('puts the recipe on the local day asked for', async () => {
			const meal = await t.plan.planMeal(actor, tacos.id, DAY0 + 2, 'DINNER', 'Europe/Brussels');
			expect(dayNumber(meal.plannedDate, 'Europe/Brussels')).toBe(DAY0 + 2);
		});

		it('refuses a recipe of another household', async () => {
			const other = await t.addRecipe('Their stew', [], 'household-2');
			await expect(t.plan.planMeal(actor, other.id, DAY0, 'DINNER', TZ)).rejects.toThrow(
				'Recipe not found'
			);
		});
	});

	describe('listMeals', () => {
		it('returns only the meals on the requested local days', async () => {
			await t.planOn(risotto, DAY0);
			await t.planOn(tacos, DAY0 + 5);
			const meals = await t.plan.listMeals(actor.householdId, DAY0, DAY0 + 2, TZ);
			expect(meals.map((meal) => meal.mealName)).toEqual(['Mushroom risotto']);
		});
	});
});
