import { describe, it, expect, beforeEach } from 'vitest';
import { createKitchen } from '../../fakes/kitchen';
import type { Actor } from '../../../src/lib/models/household';

const actor: Actor = {
	userId: 'user-1',
	householdId: 'household-1',
	memberId: 'member-1',
	displayName: 'Noor',
	roles: { plans: true, shops: true, cooks: true }
};
const neighbour: Actor = { ...actor, userId: 'user-2', householdId: 'household-2' };
const MONDAY_EVENING = new Date('2026-11-09T19:00:00Z');

describe('KitchenService', () => {
	let kitchen: ReturnType<typeof createKitchen>;
	let recipeId: string;

	beforeEach(async () => {
		kitchen = createKitchen();
		const recipe = await kitchen.recipes.create({
			userId: actor.userId,
			householdId: actor.householdId,
			title: 'Spinach pasta',
			instructions: 'Cook.',
			servings: 2,
			estimatedCalories: 600
		});
		recipeId = recipe.id;
		await kitchen.ingredients.createMany([
			{ recipeId, name: 'Pasta', quantity: '200', unit: 'g', unitType: 'WEIGHT', orderIndex: 0 },
			{
				recipeId,
				name: 'Olive oil',
				quantity: '2',
				unit: 'tbsp',
				unitType: 'VOLUME',
				orderIndex: 1
			},
			{
				recipeId,
				name: 'Chilli flakes',
				quantity: '1',
				unit: 'pinch',
				unitType: 'COUNT',
				orderIndex: 2
			}
		]);
	});

	function cook(servings: number, plannedMealId?: string) {
		return kitchen.service.recordCooked({
			actor,
			recipeId,
			plannedMealId,
			servings,
			at: MONDAY_EVENING
		});
	}

	describe('recordCooked', () => {
		it('scales the ingredients by the servings cooked', async () => {
			const event = await cook(4);

			expect(event.payload?.ingredients?.[0]).toEqual({
				itemKey: 'pasta',
				quantity: 400,
				unit: 'g'
			});
		});

		it('converts recipe units to kitchen units', async () => {
			const event = await cook(2);

			expect(event.payload?.ingredients?.[1]).toEqual({
				itemKey: 'olive oil',
				quantity: 30,
				unit: 'ml'
			});
		});

		it('keeps an unconvertible amount as an estimate', async () => {
			const event = await cook(2);

			expect(event.payload?.ingredients?.[2]?.estimate).toBe(true);
		});

		it('cooks the extra portions from the same ingredients', async () => {
			const event = await kitchen.service.recordCooked({
				actor,
				recipeId,
				servings: 2,
				extraPortions: 2,
				at: MONDAY_EVENING
			});

			expect(event.payload?.ingredients?.[0]?.quantity).toBe(400);
		});

		it('marks the planned meal cooked', async () => {
			const meal = await kitchen.plannedMeals.create({
				userId: actor.userId,
				householdId: actor.householdId,
				recipeId,
				mealName: 'Spinach pasta',
				plannedDate: MONDAY_EVENING,
				plannedCalories: 600,
				mealType: 'DINNER'
			});

			await cook(2, meal.id);

			expect((await kitchen.plannedMeals.findById(meal.id))?.status).toBe('COOKED');
		});

		it('logs the meal for the member who cooked it', async () => {
			await cook(2);

			const logs = await kitchen.mealLogs.findByUserId(actor.userId);
			expect(logs.map((log) => log.foodName)).toEqual(['Spinach pasta']);
		});

		it("refuses a recipe from another household's kitchen", async () => {
			await expect(
				kitchen.service.recordCooked({
					actor: neighbour,
					recipeId,
					servings: 2,
					at: MONDAY_EVENING
				})
			).rejects.toThrow('Recipe not found');
		});
	});

	describe('recordShopDone', () => {
		it('writes a purchase per item and then closes the shop', async () => {
			await kitchen.service.recordShopDone({
				author: actor,
				method: 'TICK',
				items: [{ name: 'Milk', quantity: 1000, unit: 'ml' }, { name: 'Eggs' }],
				at: MONDAY_EVENING
			});

			expect(kitchen.events.all(actor.householdId).map((e) => [e.kind, e.itemKey])).toEqual([
				['BOUGHT', 'milk'],
				['BOUGHT', 'eggs'],
				['SHOP_DONE', null]
			]);
		});
	});

	describe('getPicture', () => {
		it('reflects an item reported gone', async () => {
			await kitchen.service.recordShopDone({
				author: actor,
				method: 'RECEIPT',
				items: [
					{ name: 'Milk', quantity: 1000, unit: 'ml', category: 'dairy' },
					{ name: 'Rice', quantity: 1000, unit: 'g', category: 'pantry' }
				],
				at: MONDAY_EVENING
			});
			await kitchen.service.correct({
				actor,
				itemKey: 'Milk',
				kind: 'CORRECTED_GONE',
				at: new Date('2026-11-10T08:00:00Z')
			});

			const picture = await kitchen.service.getPicture(
				actor.householdId,
				new Date('2026-11-10T12:00:00Z'),
				'UTC'
			);

			expect(picture.stock.map((item) => item.itemKey)).toEqual(['rice']);
		});

		it('still holds a long-lived purchase older than 90 days', async () => {
			await kitchen.service.recordBought(
				actor,
				[{ name: 'Tinned tomatoes', quantity: 4, unit: 'count', category: 'canned' }],
				new Date('2026-06-01T10:00:00Z'),
				'manual'
			);

			const picture = await kitchen.service.getPicture(actor.householdId, MONDAY_EVENING, 'UTC');

			expect(picture.stock.map((item) => item.itemKey)).toEqual(['tinned tomatoes']);
		});
	});
});
