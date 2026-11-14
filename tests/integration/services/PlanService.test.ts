import { describe, it, expect, beforeEach } from 'vitest';
import { createTonight, actor } from '../../fakes/tonight';
import { DAY0, TZ, at, bought } from '../../helpers/kitchenEvents';
import { dayNumber } from '../../../src/lib/services/kitchen';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC. "Now" is Monday 18:00.
const NOW = at(0, 18);

describe('PlanService', () => {
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
		return t.plan.moveToNextFreeDay(actor.householdId, mealId, NOW, TZ);
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
			expect(result.keptBy?.itemKey).toBe('mushrooms');
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
			await t.plan.moveToNextFreeDay(actor.householdId, meal.id, NOW, TZ, {
				ifNoDay: 'EATEN_OUT'
			});
			expect((await t.plannedMeals.findById(meal.id))?.status).toBe('EATEN_OUT');
		});

		it('refuses a meal of another household', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await expect(t.plan.moveToNextFreeDay('household-2', meal.id, NOW, TZ)).rejects.toThrow(
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
