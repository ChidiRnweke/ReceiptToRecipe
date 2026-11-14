import { describe, it, expect, beforeEach } from 'vitest';
import { createTonight, actor } from '../../fakes/tonight';
import { DAY0, TZ, at, bought } from '../../helpers/kitchenEvents';
import { dayNumber } from '../../../src/lib/services/kitchen';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC. "Now" is Monday 18:00.
const NOW = at(0, 18);

describe('TonightController', () => {
	let t: ReturnType<typeof createTonight>;
	let risotto: { id: string; title: string };
	let saag: { id: string; title: string };

	beforeEach(async () => {
		t = createTonight();
		risotto = await t.addRecipe('Mushroom risotto', [
			{ name: 'Mushrooms', quantity: 250, unit: 'g' },
			{ name: 'Rice', quantity: 200, unit: 'g' }
		]);
		saag = await t.addRecipe('Saag paneer', [
			{ name: 'Spinach', quantity: 200, unit: 'g' },
			{ name: 'Paneer', quantity: 200, unit: 'g' }
		]);
	});

	describe('getTonight', () => {
		it('shows the dinner planned for tonight', async () => {
			await t.planOn(risotto, DAY0);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.meal?.title).toBe('Mushroom risotto');
		});

		it('greets the member by first name', async () => {
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.greeting).toBe('Good evening, Noor');
		});

		it('offers three ideas when nothing is planned', async () => {
			await t.addRecipe('Pea gnocchi', [{ name: 'Gnocchi', quantity: 500, unit: 'g' }]);
			await t.addRecipe('Lentil dal', [{ name: 'Lentils', quantity: 200, unit: 'g' }]);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.ideas).toHaveLength(3);
		});

		it('says what the planned dinner is short of', async () => {
			await t.events.append(bought('rice', 1000, 'g', 0, { category: 'pantry' }));
			await t.planOn(risotto, DAY0);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.meal?.missing).toEqual(['mushrooms']);
		});

		it('names the perishable the dinner uses before it goes', async () => {
			await t.events.append(bought('spinach', 250, 'g', 0, { expiresInDays: 1 }));
			await t.planOn(saag, DAY0);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.meal?.uses).toEqual(['spinach']);
		});

		it('shows calories left for a member with a goal', async () => {
			await t.preferences.create({ userId: actor.userId, caloricGoal: 2000 });
			await t.mealLogs.create({
				userId: actor.userId,
				foodName: 'Lunch',
				calories: 1240,
				consumedAt: at(0, 13),
				mealType: 'LUNCH'
			});
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.calorieLeft).toBe(760);
		});

		it('shows tomorrow’s dinner under the card', async () => {
			await t.planOn(risotto, DAY0);
			await t.planOn(saag, DAY0 + 1);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.tomorrowLine?.title).toBe('Saag paneer');
		});
	});

	describe('cook', () => {
		it('records a COOKED event for the planned meal', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await t.controller.cook(actor, { plannedMealId: meal.id }, NOW, TZ);
			const cooked = await t.events.listByKind(actor.householdId, 'COOKED');
			expect(cooked.map((event) => event.plannedMealId)).toEqual([meal.id]);
		});

		it('shows the dinner as eaten afterwards', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await t.controller.cook(actor, { plannedMealId: meal.id }, NOW, TZ);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.state).toBe('eaten');
		});

		it('plans a recipe cooked on its own as tonight’s dinner', async () => {
			await t.controller.cook(actor, { recipeId: saag.id }, NOW, TZ);
			const meals = await t.plan.listMeals(actor.householdId, DAY0, DAY0, TZ);
			expect(meals.map((meal) => [meal.mealName, meal.mealType, meal.status])).toEqual([
				['Saag paneer', 'DINNER', 'COOKED']
			]);
		});
	});

	describe('pickAlternative', () => {
		it('moves the old dinner to the next free day', async () => {
			const old = await t.planOn(risotto, DAY0);
			await t.controller.pickAlternative(actor, saag.id, NOW, TZ);
			const stored = await t.plannedMeals.findById(old.id);
			expect(dayNumber(stored!.plannedDate, TZ)).toBe(DAY0 + 1);
		});

		it('plans the picked recipe for tonight', async () => {
			await t.planOn(risotto, DAY0);
			await t.controller.pickAlternative(actor, saag.id, NOW, TZ);
			const view = await t.controller.getTonight(actor, NOW, TZ);
			expect(view.meal?.title).toBe('Saag paneer');
		});

		it('says where the old dinner went', async () => {
			await t.planOn(risotto, DAY0);
			const result = await t.controller.pickAlternative(actor, saag.id, NOW, TZ);
			expect(result.message).toBe('Saag paneer tonight. Mushroom risotto moves to Tuesday.');
		});
	});

	describe('alternatives', () => {
		it('leaves out the planned recipe', async () => {
			await t.planOn(risotto, DAY0);
			const ideas = await t.controller.alternatives(actor, NOW, TZ);
			expect(ideas.map((idea) => idea.title)).toEqual(['Saag paneer']);
		});
	});

	describe('eatOut', () => {
		it('changes nothing when nothing is planned', async () => {
			await t.controller.eatOut(actor, NOW, TZ);
			const meals = await t.plannedMeals.findByHouseholdId(actor.householdId);
			expect(meals).toEqual([]);
		});

		it('moves tonight’s dinner to tomorrow', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await t.controller.eatOut(actor, NOW, TZ);
			const stored = await t.plannedMeals.findById(meal.id);
			expect(dayNumber(stored!.plannedDate, TZ)).toBe(DAY0 + 1);
		});

		it('keeps a moved dinner planned', async () => {
			const meal = await t.planOn(risotto, DAY0);
			await t.controller.eatOut(actor, NOW, TZ);
			expect((await t.plannedMeals.findById(meal.id))?.status).toBe('PLANNED');
		});

		it('marks a dinner with nowhere to go as eaten out', async () => {
			const meal = await t.planOn(risotto, DAY0);
			for (const day of [1, 2, 3]) await t.planOn(saag, DAY0 + day);
			await t.controller.eatOut(actor, NOW, TZ);
			expect((await t.plannedMeals.findById(meal.id))?.status).toBe('EATEN_OUT');
		});

		it('says when the moved dinner is now', async () => {
			await t.planOn(risotto, DAY0);
			const result = await t.controller.eatOut(actor, NOW, TZ);
			expect(result.message).toBe('Enjoy! Mushroom risotto is tomorrow now.');
		});
	});
});
