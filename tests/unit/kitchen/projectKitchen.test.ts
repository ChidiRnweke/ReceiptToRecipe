import { describe, it, expect } from 'vitest';
import { projectKitchen, stockAt } from '../../../src/lib/services/kitchen';
import { at, bought, cooked, corrected, DAY0, TZ } from '../../helpers/kitchenEvents';

function stockOn(events: Parameters<typeof projectKitchen>[0], day: number) {
	return stockAt(projectKitchen(events, at(day, 23), TZ), DAY0 + day);
}

describe('projectKitchen', () => {
	describe('buying', () => {
		it('adds a lot the app knows the amount of', () => {
			const stock = stockOn([bought('rice', 1000, 'g', 0, { category: 'pantry' })], 0);

			expect(stock).toEqual([
				{
					itemKey: 'rice',
					quantity: 1000,
					unit: 'g',
					expiresOn: DAY0 + 90,
					known: true,
					off: false
				}
			]);
		});

		it('takes the shelf life from the category when the event has no expiry', () => {
			const lots = projectKitchen(
				[bought('steak', 400, 'g', 0, { category: 'meat' })],
				at(0, 23),
				TZ
			);

			expect(lots[0].expiresOn).toBe(DAY0 + 5);
		});
	});

	describe('cooking', () => {
		const twoMilks = [
			bought('milk', 1000, 'ml', 0, { expiresInDays: 8 }),
			bought('milk', 1000, 'ml', 0, { expiresInDays: 2 })
		];

		it('draws on the lot that expires soonest first', () => {
			const lots = projectKitchen(
				[...twoMilks, cooked(1, [{ itemKey: 'milk', quantity: 300, unit: 'ml' }])],
				at(1, 23),
				TZ
			);

			expect(lots.find((lot) => lot.expiresOn === DAY0 + 2)?.quantity).toBe(700);
		});

		it('marks the lot it drew on as an estimate', () => {
			const lots = projectKitchen(
				[...twoMilks, cooked(1, [{ itemKey: 'milk', quantity: 300, unit: 'ml' }])],
				at(1, 23),
				TZ
			);

			expect(lots.find((lot) => lot.expiresOn === DAY0 + 2)?.known).toBe(false);
		});

		it('converts the recipe unit to the lot unit', () => {
			const lots = projectKitchen(
				[
					bought('flour', 1, 'kg', 0, { category: 'pantry' }),
					cooked(1, [{ itemKey: 'flour', quantity: 250, unit: 'g' }])
				],
				at(1, 23),
				TZ
			);

			expect(lots[0].quantity).toBe(0.75);
		});

		it('finishes a perishable lot cooked down below 15% of what was bought', () => {
			const stock = stockOn(
				[
					bought('spinach', 200, 'g', 0, { category: 'produce' }),
					cooked(1, [{ itemKey: 'spinach', quantity: 180, unit: 'g' }])
				],
				1
			);

			expect(stock).toEqual([]);
		});

		it('keeps a long-lived lot cooked down below 15%', () => {
			const stock = stockOn(
				[
					bought('rice', 1000, 'g', 0, { category: 'pantry' }),
					cooked(1, [{ itemKey: 'rice', quantity: 900, unit: 'g' }])
				],
				1
			);

			expect(stock[0]?.quantity).toBe(100);
		});
	});

	describe('corrections', () => {
		it('extends the expiry to at least the next day when the item is still good', () => {
			const stock = stockOn(
				[
					bought('bread', 1, 'count', 0, { category: 'bakery' }),
					corrected('CORRECTED_STILL_GOOD', 'bread', 6)
				],
				7
			);

			expect(stock[0]?.off).toBe(false);
		});

		it('makes an estimated lot known again when the item is still good', () => {
			const stock = stockOn(
				[
					bought('rice', 1000, 'g', 0, { category: 'pantry' }),
					cooked(1, [{ itemKey: 'rice', quantity: 200, unit: 'g' }]),
					corrected('CORRECTED_STILL_GOOD', 'rice', 2)
				],
				2
			);

			expect(stock[0]?.known).toBe(true);
		});

		it('leaves no stock of an item reported gone', () => {
			const stock = stockOn(
				[
					bought('milk', 1000, 'ml', 0, { category: 'dairy' }),
					corrected('CORRECTED_GONE', 'milk', 1)
				],
				1
			);

			expect(stock).toEqual([]);
		});

		it('sets the total of an item to the corrected quantity', () => {
			const stock = stockOn(
				[
					bought('egg', 6, 'count', 0, { category: 'dairy' }),
					bought('egg', 6, 'count', 1, { category: 'dairy' }),
					corrected('CORRECTED_QUANTITY', 'egg', 2, 4)
				],
				2
			);

			expect(stock[0]?.quantity).toBe(4);
		});
	});

	describe('leftovers', () => {
		const curry = cooked(0, [], { portions: 2, plannedMealId: 'meal-1' });

		it('puts the extra portions aside as a leftover lot of the meal', () => {
			const stock = stockOn([curry], 0);

			expect(stock).toEqual([
				{
					itemKey: 'leftover:meal-1',
					quantity: 2,
					unit: 'portion',
					expiresOn: DAY0 + 4,
					known: true,
					off: false,
					leftoverOf: 'meal-1'
				}
			]);
		});

		it('keeps leftovers good for four days', () => {
			const stock = stockOn([curry], 4);

			expect(stock[0]?.off).toBe(false);
		});

		it('turns leftovers off on the fifth day', () => {
			const stock = stockOn([curry], 5);

			expect(stock[0]?.off).toBe(true);
		});
	});

	it('ignores events after the moment it projects', () => {
		const lots = projectKitchen([bought('rice', 1000, 'g', 3)], at(1), TZ);

		expect(lots).toEqual([]);
	});
});
