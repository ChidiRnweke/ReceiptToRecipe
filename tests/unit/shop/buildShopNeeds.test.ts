import { describe, it, expect } from 'vitest';
import { buildShopNeeds, roundPack } from '../../../src/lib/services/shop';
import type { Lot } from '../../../src/lib/models/kitchen';
import { DAY0, TZ, at } from '../../helpers/kitchenEvents';
import { lot, meal, MON_THU, need, WEDNESDAY_EVENING } from './fixtures';

const habits = { shopDays: MON_THU, usuals: [] as string[] };

function needs(
	meals: Parameters<typeof buildShopNeeds>[1],
	lots: Lot[] = [],
	options: { usuals?: string[] } = {}
) {
	return buildShopNeeds(lots, meals, { ...habits, ...options }, WEDNESDAY_EVENING, TZ);
}

const thursday = meal('thu', 3, [need('spinach', 100, 'g'), need('paneer', 200, 'g')]);
const saturday = meal('sat', 5, [need('spinach', 150, 'g'), need('lemon', 1, 'count')]);
const tuesday = meal('tue', 8, [need('coriander', 1, 'bunch')]);

describe('buildShopNeeds', () => {
	describe('the shop the list is for', () => {
		it('is the learned shop within 36 hours', () => {
			expect(needs([thursday]).nextShop?.day).toBe(DAY0 + 3);
		});

		it('is none when no learned shop is that close', () => {
			const result = buildShopNeeds([], [thursday], habits, at(1, 6), TZ);
			expect(result.nextShop).toBeNull();
		});

		it('lists the meals of the next 48 hours when no shop is that close', () => {
			const wednesday = meal('wed', 2, [need('rice', 200, 'g')]);
			const result = buildShopNeeds([], [wednesday], habits, at(1, 6), TZ);
			expect(result.now.map((group) => group.meal.id)).toEqual(['wed']);
		});

		it('leaves meals after 48 hours off when no shop is that close', () => {
			const result = buildShopNeeds([], [thursday], habits, at(1, 6), TZ);
			expect(result.now).toEqual([]);
		});
	});

	describe('grouping by dish', () => {
		it('lists each dish that is short of something, in order', () => {
			expect(needs([saturday, thursday]).now.map((group) => group.meal.id)).toEqual(['thu', 'sat']);
		});

		it('leaves out a dish the kitchen already has everything for', () => {
			const result = needs([thursday], [lot('spinach', 500, 'g'), lot('paneer', 400, 'g')]);
			expect(result.now).toEqual([]);
		});

		it('leaves out a meal before the shop', () => {
			const wednesday = meal('wed', 2, [need('rice', 200, 'g')]);
			expect(needs([wednesday]).now).toEqual([]);
		});

		it('lets a meal before the shop eat from the kitchen first', () => {
			const wednesday = meal('wed', 2, [need('spinach', 200, 'g')]);
			const result = needs(
				[wednesday, meal('thu', 3, [need('spinach', 150, 'g')])],
				[lot('spinach', 300, 'g')]
			);
			expect(result.now[0].items[0].quantity).toBe(50);
		});

		it('skips items the household is assumed to have', () => {
			const result = buildShopNeeds([], [thursday], habits, WEDNESDAY_EVENING, TZ, {
				skip: (key) => key === 'paneer'
			});
			expect(result.now[0].items.map((item) => item.itemKey)).toEqual(['spinach']);
		});
	});

	describe('merging the same item across dishes', () => {
		const merged = () => needs([thursday, saturday]);

		it('lists it once, under the first dish', () => {
			const spinach = merged()
				.now.flatMap((g) => g.items)
				.filter((i) => i.itemKey === 'spinach');
			expect(spinach.map((item) => item.mealIds[0])).toEqual(['thu']);
		});

		it('sums the amounts', () => {
			const spinach = merged().now[0].items.find((item) => item.itemKey === 'spinach');
			expect(spinach?.quantity).toBe(250);
		});

		it('remembers the other dish’s day', () => {
			const spinach = merged().now[0].items.find((item) => item.itemKey === 'spinach');
			expect(spinach?.alsoDays).toEqual([DAY0 + 5]);
		});

		it('converts units before summing', () => {
			const result = needs([
				meal('thu', 3, [need('milk', 1, 'l')]),
				meal('fri', 4, [need('milk', 200, 'ml')])
			]);
			expect(result.now[0].items[0].quantity).toBe(1200);
		});

		it('keeps a dish whose items all merged out of the list', () => {
			const result = needs([thursday, meal('fri', 4, [need('spinach', 50, 'g')])]);
			expect(result.now.map((group) => group.meal.id)).toEqual(['thu']);
		});
	});

	describe('holding fresh things back', () => {
		it('holds a dish after the next shop for the shop after it', () => {
			expect(needs([thursday, tuesday]).later.map((group) => group.meal.id)).toEqual(['tue']);
		});

		it('keeps held dishes off the list for this shop', () => {
			expect(needs([tuesday]).now).toEqual([]);
		});

		it('names the shop held things wait for', () => {
			expect(needs([tuesday]).afterShop?.day).toBe(DAY0 + 7);
		});

		it('gives that shop its learned hour', () => {
			expect(needs([tuesday]).afterShop?.at).toEqual(at(7, 10));
		});
	});

	describe('usuals', () => {
		it('lists a usual that fell below 30% of what is usually bought', () => {
			const result = needs([], [lot('milk', 200, 'ml', { initial: 1000 })], {
				usuals: ['milk']
			});
			expect(result.usuals.map((item) => [item.itemKey, item.quantity])).toEqual([['milk', 1000]]);
		});

		it('leaves out a usual with enough at home', () => {
			const result = needs([], [lot('milk', 500, 'ml', { initial: 1000 })], { usuals: ['milk'] });
			expect(result.usuals).toEqual([]);
		});

		it('leaves out a usual it has never seen bought', () => {
			expect(needs([], [], { usuals: ['milk'] }).usuals).toEqual([]);
		});

		it('leaves out a usual a dish already lists', () => {
			const result = needs(
				[meal('thu', 3, [need('milk', 500, 'ml')])],
				[lot('milk', 100, 'ml', { initial: 1000 })],
				{ usuals: ['milk'] }
			);
			expect(result.usuals).toEqual([]);
		});
	});
});

describe('roundPack', () => {
	it('rounds grams up to the next 50 g', () => {
		expect(roundPack(130, 'g')).toBe(150);
	});

	it('rounds millilitres up to the next 100 ml', () => {
		expect(roundPack(120, 'ml')).toBe(200);
	});

	it('rounds a count up to whole items', () => {
		expect(roundPack(2.2, 'count')).toBe(3);
	});

	it('keeps an exact pack size', () => {
		expect(roundPack(250, 'g')).toBe(250);
	});
});
