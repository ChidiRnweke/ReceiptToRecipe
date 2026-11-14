import { describe, it, expect } from 'vitest';
import { forecastMeals, projectKitchen } from '../../../src/lib/services/kitchen';
import type { MealNeed } from '../../../src/lib/models/kitchen';
import { at, bought, DAY0, TZ } from '../../helpers/kitchenEvents';

const sixEggs = projectKitchen(
	[bought('egg', 6, 'count', 0, { category: 'dairy' })],
	at(0, 23),
	TZ
);

function omelette(id: string, day: number, eggs: number): MealNeed {
	return { id, day: DAY0 + day, ingredients: [{ itemKey: 'egg', quantity: eggs, unit: 'count' }] };
}

describe('forecastMeals', () => {
	it('reports the shortfall of a meal after another that uses the same item', () => {
		const forecast = forecastMeals(
			sixEggs,
			[omelette('tue', 1, 4), omelette('wed', 2, 4)],
			DAY0,
			DAY0 + 7
		);

		expect(forecast[1].missing).toEqual([{ itemKey: 'egg', quantity: 2, unit: 'count' }]);
	});

	it('reports nothing missing when the kitchen has enough', () => {
		const forecast = forecastMeals(sixEggs, [omelette('tue', 1, 4)], DAY0, DAY0 + 7);

		expect(forecast[0].missing).toEqual([]);
	});

	it('does not count lots that expire before the meal', () => {
		const lots = projectKitchen(
			[bought('spinach', 200, 'g', 0, { expiresInDays: 1 })],
			at(0, 23),
			TZ
		);
		const meal: MealNeed = {
			id: 'thu',
			day: DAY0 + 3,
			ingredients: [{ itemKey: 'spinach', quantity: 150, unit: 'g' }]
		};

		expect(forecastMeals(lots, [meal], DAY0, DAY0 + 7)[0].missing).toEqual([
			{ itemKey: 'spinach', quantity: 150, unit: 'g' }
		]);
	});

	it('lets a later meal eat the portions an earlier meal put aside', () => {
		const curry: MealNeed = { id: 'mon-dinner', day: DAY0, ingredients: [], portions: 1 };
		const lunch: MealNeed = {
			id: 'tue-lunch',
			day: DAY0 + 1,
			ingredients: [{ itemKey: 'leftover:mon-dinner', quantity: 1, unit: 'portion' }]
		};

		expect(forecastMeals([], [curry, lunch], DAY0, DAY0 + 7)[1].missing).toEqual([]);
	});

	it('leaves meals outside the range out of the forecast', () => {
		const forecast = forecastMeals(sixEggs, [omelette('next-week', 9, 2)], DAY0, DAY0 + 7);

		expect(forecast).toEqual([]);
	});

	it('does not change the lots it is given', () => {
		forecastMeals(sixEggs, [omelette('tue', 1, 4)], DAY0, DAY0 + 7);

		expect(sixEggs[0].quantity).toBe(6);
	});
});
